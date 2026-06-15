// token-analysis.mjs — aggregate a full, honest on-chain token report from existing primitives
// (getAccountInfo / getTokenLargestAccounts / Jupiter quotes / DAS / trader discovery). Read-only,
// never on the trading path. Every field carries a source; anything unreadable goes in
// missing_data — nothing is fabricated. Scoring + extension classification are PURE (unit-tested);
// analyzeToken is the async orchestrator.

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Token-2022 extensions and how each bears on trading/copying (item 19).
export const EXTENSION_INFO = {
  transferFeeConfig: { label: 'Transfer fee', risk: 'med', meaning: 'A fee is skimmed on every transfer — erodes P&L and complicates exact accounting.', affects_trading: true },
  transferHook: { label: 'Transfer hook', risk: 'high', meaning: 'Custom program runs on every transfer — can block or tax sells (honeypot vector).', affects_trading: true },
  permanentDelegate: { label: 'Permanent delegate', risk: 'high', meaning: 'A delegate can move/burn anyone’s tokens at will — severe rug vector.', affects_trading: true },
  defaultAccountState: { label: 'Default account state', risk: 'high', meaning: 'New accounts may default to frozen — you could be unable to sell.', affects_trading: true },
  nonTransferable: { label: 'Non-transferable', risk: 'high', meaning: 'Tokens cannot be transferred at all — unsellable.', affects_trading: true },
  confidentialTransferMint: { label: 'Confidential transfer', risk: 'med', meaning: 'Confidential balances — opaque, complicates routing/accounting.', affects_trading: true },
  metadataPointer: { label: 'Metadata pointer', risk: 'info', meaning: 'Points to a metadata account — informational.', affects_trading: false },
  tokenMetadata: { label: 'Inline metadata', risk: 'info', meaning: 'On-mint metadata — informational.', affects_trading: false },
  interestBearingConfig: { label: 'Interest bearing', risk: 'low', meaning: 'Balance accrues nominal interest — minor accounting effect.', affects_trading: false },
  mintCloseAuthority: { label: 'Mint close authority', risk: 'low', meaning: 'The mint can be closed — minor; metadata may disappear.', affects_trading: false },
};

/** Pure: classify the parsed Token-2022 extension list. */
export function classifyExtensions(extensions = []) {
  const out = [];
  for (const e of Array.isArray(extensions) ? extensions : []) {
    const key = typeof e === 'string' ? e : e?.extension;
    if (!key || key === 'uninitialized') continue;
    const info = EXTENSION_INFO[key];
    out.push(info ? { key, ...info, present: true } : { key, label: key, risk: 'info', meaning: 'Unrecognized extension.', affects_trading: false, present: true });
  }
  return out;
}

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Pure scoring + verdict. `facts`:
 *  mintAuthorityActive, freezeAuthorityActive, metadataMutable (bools)
 *  extensionKeys (string[]), sellable (bool|null), slippagePct (number|null),
 *  fdvUsd (number|null), priceUsd (number|null), topHolderPct (number|null),
 *  holderCount (number|null), traderCount (number|null), dataComplete (bool)
 */
export function computeTokenScores(facts = {}) {
  const reasons = [];
  const add = (severity, code, text) => reasons.push({ severity, code, text });

  let risk = 0;
  if (facts.mintAuthorityActive) { risk += 30; add('high', 'mint_authority_active', 'Mint authority not revoked — supply can be inflated (dilution/rug).'); }
  if (facts.freezeAuthorityActive) { risk += 25; add('high', 'freeze_authority_active', 'Freeze authority not revoked — your tokens can be frozen.'); }
  if (facts.metadataMutable) { risk += 5; add('low', 'metadata_mutable', 'Metadata is mutable (update authority present).'); }

  const extKeys = Array.isArray(facts.extensionKeys) ? facts.extensionKeys : [];
  const extRisk = { transferHook: 15, permanentDelegate: 30, nonTransferable: 40, defaultAccountState: 25, transferFeeConfig: 10, confidentialTransferMint: 10, mintCloseAuthority: 5 };
  for (const k of extKeys) {
    if (extRisk[k]) { risk += extRisk[k]; add(extRisk[k] >= 25 ? 'high' : 'med', `ext_${k}`, `${EXTENSION_INFO[k]?.label || k}: ${EXTENSION_INFO[k]?.meaning || ''}`); }
  }

  if (facts.sellable === false) { risk += 40; add('high', 'no_sell_route', 'No sell route found — possible honeypot (cannot exit).'); }
  if (Number.isFinite(facts.slippagePct)) {
    if (facts.slippagePct >= 50) { risk += 25; add('high', 'extreme_slippage', `Extreme round-trip slippage (~${facts.slippagePct.toFixed(0)}%).`); }
    else if (facts.slippagePct >= 20) { risk += 15; add('med', 'high_slippage', `High round-trip slippage (~${facts.slippagePct.toFixed(0)}%).`); }
  }
  if (Number.isFinite(facts.topHolderPct)) {
    if (facts.topHolderPct >= 80) { risk += 20; add('high', 'extreme_concentration', `Largest account holds ~${facts.topHolderPct.toFixed(0)}% (may be the LP — verify).`); }
    else if (facts.topHolderPct >= 50) { risk += 10; add('med', 'high_concentration', `Largest account holds ~${facts.topHolderPct.toFixed(0)}% (may be the LP — verify).`); }
  }
  if (facts.priceUsd == null) { risk += 10; add('med', 'no_price', 'No price/route available — illiquid or unlisted.'); }
  risk = clamp(risk);

  // copyability: how cleanly a copy could enter AND exit this token
  let copy = 0;
  if (facts.sellable) copy += 40;
  if (Number.isFinite(facts.slippagePct)) copy += clamp(30 - Math.min(30, facts.slippagePct), 0, 30);
  if (Number.isFinite(facts.fdvUsd) && facts.fdvUsd >= 20000) copy += 15;
  if (!facts.mintAuthorityActive && !facts.freezeAuthorityActive) copy += 15;
  copy = clamp(copy);

  // opportunity (heuristic, low-confidence — no momentum feed)
  let opp = 0;
  if (Number.isFinite(facts.traderCount) && facts.traderCount > 0) opp += clamp(Math.min(40, facts.traderCount * 8));
  if (facts.priceUsd != null) opp += 20;
  if (Number.isFinite(facts.fdvUsd) && facts.fdvUsd >= 20000 && facts.fdvUsd <= 10_000_000) opp += 20;
  if (Number.isFinite(facts.holderCount) && facts.holderCount >= 50) opp += 20;
  opp = clamp(opp);

  let final_verdict;
  if (!facts.dataComplete) final_verdict = 'unanalyzable';
  else if (facts.sellable === false || risk >= 70) final_verdict = 'high_risk';
  else if (risk >= 40) final_verdict = 'watch';
  else if (copy >= 60) final_verdict = 'suitable';
  else final_verdict = 'weak';

  return { risk_score: risk, opportunity_score: opp, copyability_score: copy, opportunity_confidence: 'low', final_verdict, reasons };
}

/** Async orchestrator: build the full token report. Never throws — failures degrade to missing_data. */
// Read a parsed token-amount robustly: uiAmount is null for large / high-decimal balances, so
// prefer uiAmountString, then amount/10**decimals, before falling back to uiAmount.
function uiAmountOf(v, dec) {
  if (!v) return NaN;
  if (v.uiAmountString != null && v.uiAmountString !== '') { const n = Number(v.uiAmountString); if (Number.isFinite(n)) return n; }
  if (v.amount != null && Number.isFinite(Number(dec))) { const n = Number(v.amount) / 10 ** Number(dec); if (Number.isFinite(n)) return n; }
  const u = Number(v.uiAmount); return Number.isFinite(u) ? u : NaN;
}

export async function analyzeToken({ mint, rpc, jupiter, das = null, tokenMeta = null, discoverTraders = null }) {
  if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return { ok: false, error: 'invalid_mint' };
  }
  const missing_data = [];
  const sources = new Set();
  const rrpc = (m, p) => rpc.rpc(m, p);

  // --- identity + authorities + program + extensions (one getAccountInfo) ---
  let decimals = null; let supplyUi = null; let program = null;
  let mintAuthority = null; let freezeAuthority = null; let extensions = [];
  const acc = await rrpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]).catch(() => ({ ok: false }));
  const accVal = acc.ok ? acc.result?.value : null;
  if (accVal?.data?.parsed?.type === 'mint') {
    const info = accVal.data.parsed.info || {};
    decimals = Number(info.decimals);
    supplyUi = info.supply != null && Number.isFinite(decimals) ? Number(info.supply) / 10 ** decimals : null;
    mintAuthority = info.mintAuthority || null;
    freezeAuthority = info.freezeAuthority || null;
    extensions = info.extensions || [];
    program = accVal.owner === TOKEN_2022_PROGRAM ? 'token-2022' : accVal.owner === TOKEN_PROGRAM ? 'spl-token' : 'unknown';
    sources.add('rpc:getAccountInfo');
  } else {
    missing_data.push('mint_account_unreadable');
  }
  const extClass = classifyExtensions(extensions);

  // --- metadata (name/symbol/logo): Jupiter token list + DAS via the shared cached resolver,
  //     falling back to a direct DAS call if no resolver was wired ---
  let name = null; let symbol = null; let icon = null;
  if (tokenMeta && typeof tokenMeta.resolve === 'function') {
    const m = await tokenMeta.resolve([mint]).catch(() => ({}));
    const dm = m?.[mint];
    if (dm) { name = dm.name || null; symbol = dm.symbol || null; icon = dm.icon || null; if (name || symbol) sources.add('jupiter+das:metadata'); }
  } else if (das && typeof das.getAssetMeta === 'function') {
    const dm = await das.getAssetMeta(mint).catch(() => null);
    if (dm) { name = dm.name || null; symbol = dm.symbol || null; icon = dm.icon || null; if (name || symbol) sources.add('helius:das'); }
  }
  if (!symbol) missing_data.push('token_metadata');

  // --- price + route + slippage via Jupiter (buy $10, sell it back at the SAME slippage basis) ---
  const PROBE_BPS = 300;
  let priceUsd = null; let buyRoute = false; let sellable = null; let slippagePct = null;
  if (jupiter && Number.isFinite(decimals)) {
    const buy = await jupiter.paperBuy({ mint, sizeUsd: 10, slippageBps: PROBE_BPS }).catch(() => ({ ok: false }));
    if (buy.ok) {
      buyRoute = true; sources.add('jupiter:quote');
      const qtyUi = buy.outAmountBase / 10 ** decimals;
      if (qtyUi > 0) {
        priceUsd = 10 / qtyUi;
        const sell = await jupiter.usdValueOf({ mint, qtyUi, decimals, slippageBps: PROBE_BPS }).catch(() => ({ ok: false, error: 'sell_quote_error' }));
        if (sell.ok) { sellable = true; slippagePct = Math.max(0, ((10 - sell.usd) / 10) * 100); }
        else if (sell.error === 'quote_no_route' || sell.error === 'zero_amount') { sellable = false; } // genuine: cannot exit
        else { sellable = null; missing_data.push('sell_route'); } // transient quote error — unknown, NOT a honeypot
      }
    } else { buyRoute = false; missing_data.push('price_route'); }
  } else { missing_data.push('price_route'); }
  const fdvUsd = (Number.isFinite(supplyUi) && supplyUi > 0 && priceUsd != null) ? supplyUi * priceUsd : null;
  if (fdvUsd == null) missing_data.push('fdv');

  // --- holders + concentration via getTokenLargestAccounts (uiAmount is null for big balances) ---
  let topHolders = []; let topHolderPct = null; let top5Pct = null;
  const la = await rrpc('getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]).catch(() => ({ ok: false }));
  if (la.ok && Array.isArray(la.result?.value) && Number.isFinite(supplyUi) && supplyUi > 0) {
    sources.add('rpc:getTokenLargestAccounts');
    topHolders = la.result.value.slice(0, 10).map((h) => {
      const amt = uiAmountOf(h, h.decimals ?? decimals);
      const amount_ui = Number.isFinite(amt) ? amt : 0;
      return { address: h.address, amount_ui, pct: (amount_ui / supplyUi) * 100 };
    });
    topHolderPct = topHolders[0]?.pct ?? null;
    top5Pct = topHolders.slice(0, 5).reduce((a, h) => a + h.pct, 0);
  } else { missing_data.push('holders'); }

  // holder count (≥N) via DAS getTokenAccounts (best-effort; Helius-only)
  let holderCount = null;
  const ta = await rrpc('getTokenAccounts', { mint, limit: 1000, page: 1 }).catch(() => ({ ok: false }));
  if (ta.ok && Array.isArray(ta.result?.token_accounts)) { holderCount = ta.result.token_accounts.length; if (holderCount === 1000) holderCount = '1000+'; sources.add('helius:getTokenAccounts'); }
  else missing_data.push('holder_count');

  // --- last activity (newest signature blockTime) ---
  let lastActivity = null;
  const sig = await rrpc('getSignaturesForAddress', [mint, { limit: 1 }]).catch(() => ({ ok: false }));
  if (sig.ok && Array.isArray(sig.result) && sig.result[0]?.blockTime) { lastActivity = new Date(sig.result[0].blockTime * 1000).toISOString(); sources.add('rpc:getSignaturesForAddress'); }

  // --- smart-money relation (optional, capped) ---
  let traderCount = null; let traders = [];
  if (typeof discoverTraders === 'function') {
    const d = await discoverTraders({ mint }).catch(() => null);
    if (d?.ok) { traders = (d.traders || []).slice(0, 10); traderCount = traders.length; sources.add('rpc:trader-discovery'); }
  }

  const dataComplete = accVal?.data?.parsed?.type === 'mint' && Number.isFinite(decimals);
  const metadataMutable = false; // update-authority parse not exposed by jsonParsed mint; treated unknown→false
  // '1000+' (page-capped) still counts as a high holder count for scoring, not null
  const holderCountNum = typeof holderCount === 'number' ? holderCount : (holderCount === '1000+' ? 1000 : null);
  const scores = computeTokenScores({
    mintAuthorityActive: !!mintAuthority,
    freezeAuthorityActive: !!freezeAuthority,
    metadataMutable,
    extensionKeys: extClass.map((e) => e.key),
    sellable, slippagePct, fdvUsd, priceUsd,
    topHolderPct, holderCount: holderCountNum, traderCount,
    dataComplete,
  });

  return {
    ok: true,
    mint,
    token_identity: { mint, name, symbol, icon, decimals, supply_ui: supplyUi, program },
    market_data: { price_usd: priceUsd, fdv_usd: fdvUsd, volume_usd: null, last_activity: lastActivity },
    liquidity_data: { buy_route: buyRoute, sellable, round_trip_slippage_pct: slippagePct != null ? Math.round(slippagePct * 10) / 10 : null, pools: null },
    holder_analysis: { holder_count: holderCount, top_holders: topHolders, top_holder_pct: topHolderPct != null ? Math.round(topHolderPct * 10) / 10 : null, top5_pct: top5Pct != null ? Math.round(top5Pct * 10) / 10 : null },
    authority_analysis: { mint_authority: mintAuthority, freeze_authority: freezeAuthority, mint_revoked: !mintAuthority, freeze_revoked: !freezeAuthority },
    token_2022_analysis: { is_token_2022: program === 'token-2022', extensions: extClass },
    trading_route_analysis: { buy_route: buyRoute, sell_route: sellable, jupiter: buyRoute },
    smart_money_relation: { trader_count: traderCount, traders },
    risk_score: scores.risk_score,
    opportunity_score: scores.opportunity_score,
    opportunity_confidence: scores.opportunity_confidence,
    copyability_score: scores.copyability_score,
    final_verdict: scores.final_verdict,
    reasons: scores.reasons,
    evidence_sources: [...sources],
    missing_data,
    provenance: 'on_chain',
  };
}
