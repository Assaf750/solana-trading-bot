// live-executor.mjs — the ONLY path that moves real money. Every call passes the full
// gate chain, is idempotent via the intent ledger, audited before signing and after
// sending, and fails closed on ANY anomaly. SOL-denominated swaps (every funded
// wallet holds SOL): buy = SOL -> token, sell = token -> SOL.
import { createHash } from 'node:crypto';
import { readJson, writeJson, nowIso } from '../util.mjs';
import { seedFromStoredSecret, keypairFromSeed, signSerializedTransaction } from './tx-signer.mjs';
import { WSOL_MINT, USDC_MINT } from './swap-detector.mjs';

const INTENTS_FILE = 'intent-ledger.json';
const SOL_RESERVE_LAMPORTS = 0.05 * 1e9; // never spend the fee/rent reserve
const SIGNER_SECRET_NAME = 'signer_keypair';

export function createLiveExecutor({ config, vault, signer, killSwitch, operatingState, rpc, jupiter, audit, broadcast }) {
  let solPriceCache = { usd: null, at: 0 };

  // ---------- intent ledger (idempotency: a retry can NEVER duplicate an on-chain tx) ----------
  function ledger() { return readJson(INTENTS_FILE, { intents: {} }).value; }
  function saveLedger(l) { writeJson(INTENTS_FILE, l); }
  function intentIdFor(parts) {
    return `int_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)}`;
  }
  // States that PROVABLY never reached the chain — safe to retry (e.g. a stop-loss whose
  // first broadcast hit a transient RPC error). SENT/SENT_PENDING/SENT_UNCONFIRMED/CONFIRMED
  // may have landed, so they stay blocked (no double-spend).
  const RETRYABLE_STATUSES = new Set(['FAILED_PRE_SEND', 'FAILED_SEND']);
  function claimIntent(intent_id, detail) {
    const l = ledger();
    const existing = l.intents[intent_id];
    if (existing && !RETRYABLE_STATUSES.has(existing.status)) {
      return { ok: false, error: `intent_duplicate_${existing.status}` };
    }
    l.intents[intent_id] = { status: 'PENDING', ts: nowIso(), detail };
    saveLedger(l);
    return { ok: true };
  }
  function setIntent(intent_id, status, extra = {}) {
    const l = ledger();
    if (l.intents[intent_id]) {
      l.intents[intent_id] = { ...l.intents[intent_id], status, ...extra, updated_at: nowIso() };
      saveLedger(l);
    }
  }

  // ---------- helpers ----------
  function safeAudit(record) {
    try { audit(record); return true; } catch { return false; }
  }

  function ownerKeypair() {
    const r = vault.getSecretForUse(SIGNER_SECRET_NAME);
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const seed = seedFromStoredSecret(r.value);
      const kp = keypairFromSeed(seed);
      return { ok: true, kp, seed };
    } catch (e) {
      return { ok: false, error: String(e?.message || 'key_parse_failed') };
    }
  }

  async function solPriceUsd() {
    if (solPriceCache.usd && Date.now() - solPriceCache.at < 60000) return solPriceCache.usd;
    const q = await jupiter.quote({ inputMint: WSOL_MINT, outputMint: USDC_MINT, amountBaseUnits: 1e9 });
    if (!q.ok) return null;
    const usd = q.outAmount / 1e6;
    // plausibility band: a glitched/manipulated SOL-USDC quote must NOT silently mis-size every
    // buy (amountBaseUnits = sizeUsd/price). Reject anything outside a sane SOL price range.
    if (!Number.isFinite(usd) || usd < 1 || usd > 100000) return null;
    solPriceCache = { usd, at: Date.now() };
    return usd;
  }

  /** Full gate chain. action: 'entry' | 'exit'. Fail-closed: any uncertainty refuses. */
  function gates({ action, notionalUsd }) {
    const cfg = config.get();
    const refusals = [];
    if (cfg.mode !== 'real_live') refusals.push('mode_not_real_live');
    const kill = killSwitch.isBlocked({ mode: 'real_live' });
    if (kill.blocked) refusals.push(`kill_switch_${kill.level}`);
    const op = operatingState.get().operating_state;
    if (action === 'entry' && op !== 'ACTIVE') refusals.push(`operating_state_${op}_blocks_entry`);
    if (action === 'exit' && !['ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED'].includes(op)) refusals.push(`operating_state_${op}_blocks_exit`);
    if (!vault.isUnlocked()) refusals.push('vault_locked');
    const can = signer.canSignNow({ notional_usd: notionalUsd });
    if (!can.allowed) refusals.push(`signer_${can.reason}`);
    return { allowed: refusals.length === 0, refusals };
  }

  async function confirmSignature(signatureB58) {
    for (let i = 0; i < 24; i += 1) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await rpc.rpc('getSignatureStatuses', [[signatureB58], { searchTransactionHistory: false }]);
      const v = st.ok ? st.result?.value?.[0] : null;
      if (v) {
        if (v.err) return { confirmed: false, error: 'tx_failed_on_chain' };
        if (v.confirmationStatus === 'confirmed' || v.confirmationStatus === 'finalized') return { confirmed: true };
      }
    }
    return { confirmed: false, error: 'confirmation_timeout' };
  }

  /**
   * Execute a real swap. side 'buy': spend sizeUsd worth of SOL into mint.
   * side 'sell': sell qtyUi of mint back to SOL. Returns actual fill data.
   */
  async function executeSwapInner({ side, mint, sizeUsd = 0, qtyUi = 0, decimals = 6, slippageBps = 100, intentParts }, releaseLock = () => {}) {
    const notionalUsd = side === 'buy' ? sizeUsd : sizeUsd; // sell passes estimated proceeds in sizeUsd
    const g = gates({ action: side === 'buy' ? 'entry' : 'exit', notionalUsd });
    if (!g.allowed) return { ok: false, error: 'gates_refused', refusals: g.refusals };

    const intent_id = intentIdFor(intentParts);
    const claim = claimIntent(intent_id, { side, mint, sizeUsd, qtyUi });
    if (!claim.ok) return { ok: false, error: claim.error };

    const kpRes = ownerKeypair();
    if (!kpRes.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: kpRes.error }); return { ok: false, error: kpRes.error }; }
    const owner = kpRes.kp.address;

    // amounts
    const price = await solPriceUsd();
    if (!price) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'sol_price_unavailable' }); return { ok: false, error: 'sol_price_unavailable' }; }
    let inputMint, outputMint, amountBaseUnits;
    if (side === 'buy') {
      inputMint = WSOL_MINT; outputMint = mint;
      amountBaseUnits = Math.floor((sizeUsd / price) * 1e9);
      const bal = await rpc.rpc('getBalance', [owner, { commitment: 'confirmed' }]);
      const lamports = bal.ok ? Number(bal.result?.value ?? 0) : 0;
      if (!bal.ok || lamports < amountBaseUnits + SOL_RESERVE_LAMPORTS) {
        setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'insufficient_sol_balance' });
        return { ok: false, error: 'insufficient_sol_balance', balance_sol: lamports / 1e9 };
      }
    } else {
      inputMint = mint; outputMint = WSOL_MINT;
      amountBaseUnits = Math.floor(qtyUi * 10 ** decimals);
    }
    if (amountBaseUnits <= 0) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'amount_zero' }); return { ok: false, error: 'amount_zero' }; }

    const q = await jupiter.quote({ inputMint, outputMint, amountBaseUnits, slippageBps });
    if (!q.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: q.error }); return { ok: false, error: q.error }; }

    const swap = await jupiter.swapTransaction({ quoteRaw: q.raw, userPublicKey: owner });
    if (!swap.ok) { setIntent(intent_id, 'FAILED_PRE_SEND', { error: swap.error }); return { ok: false, error: swap.error }; }

    // audit BEFORE signing — if audit cannot be written, we do not sign (fail-closed)
    if (!safeAudit({ audit_scope: 'intent', audit_reason: 'live_sign_requested', command_type: null, detail: { intent_id, side, mint, notional_usd: notionalUsd, owner } })) {
      setIntent(intent_id, 'FAILED_PRE_SEND', { error: 'audit_unavailable_before_sign' });
      return { ok: false, error: 'audit_unavailable_before_sign' };
    }

    let signed;
    try {
      signed = signSerializedTransaction({ txBase64: swap.txBase64, seed: kpRes.seed });
    } catch (e) {
      setIntent(intent_id, 'FAILED_PRE_SEND', { error: String(e?.message || 'sign_failed') });
      return { ok: false, error: String(e?.message || 'sign_failed') };
    }

    setIntent(intent_id, 'SENT_PENDING');
    const sent = await rpc.rpc('sendTransaction', [signed.signedTxBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 3 }]);
    if (!sent.ok) {
      // Distinguish PROVABLY-unsent from ambiguous failures. A JSON-RPC error response
      // (`rpc_<code>`, e.g. preflight/simulation rejection) means the node refused the tx
      // before submission -> never landed -> FAILED_SEND (retryable). A timeout / HTTP 5xx /
      // retries-exhausted (`rpc_failed_*`, `rpc_http_*`, `rpc_retries_exhausted`) may have
      // been forwarded to the cluster -> SENT_UNCONFIRMED (NOT retryable; needs reconciliation,
      // so an auto-retry can't build a second tx that double-executes).
      const provablyUnsent = /^rpc_-?\d+$/.test(sent.error || '');
      const status = provablyUnsent ? 'FAILED_SEND' : 'SENT_UNCONFIRMED';
      setIntent(intent_id, status, { error: sent.error });
      safeAudit({ audit_scope: 'intent', audit_reason: 'live_send_failed', detail: { intent_id, error: sent.error, status } });
      return { ok: false, error: `send_failed_${sent.error}` };
    }
    const txSig = sent.result;
    setIntent(intent_id, 'SENT', { signature: txSig });
    // count notional only after a successful broadcast (failed sends must not consume the cap)
    signer.recordSigned({ notional_usd: notionalUsd });
    // critical section (gates→claim→send→record) is done — release the serialization lock so the
    // ~60s confirmation poll below does NOT block another swap (e.g. a stop-loss exit) behind it.
    releaseLock();
    safeAudit({ audit_scope: 'intent', audit_reason: 'live_tx_sent', detail: { intent_id, signature: txSig, side, mint } });
    broadcast({ event_type: 'intent_update', intent_id, signature: txSig, side, mint });

    const conf = await confirmSignature(txSig);
    if (!conf.confirmed) {
      setIntent(intent_id, conf.error === 'tx_failed_on_chain' ? 'FAILED_ON_CHAIN' : 'SENT_UNCONFIRMED', { error: conf.error });
      return { ok: false, error: conf.error, signature: txSig };
    }

    // actual fill amounts from the confirmed tx (bounded attempts; estimate fallback)
    let actualOutUi = q.outAmount / 10 ** (side === 'buy' ? decimals : 9);
    let fillSource = 'quote_estimate';
    for (let i = 0; i < 3; i += 1) {
      const tx = await rpc.getTransaction(txSig);
      if (tx.ok && tx.result) {
        const meta = tx.result.meta;
        if (meta && !meta.err) {
          const target = side === 'buy' ? mint : WSOL_MINT;
          const pre = (meta.preTokenBalances || []).find((b) => b.owner === owner && b.mint === target);
          const post = (meta.postTokenBalances || []).find((b) => b.owner === owner && b.mint === target);
          if (side === 'buy' && post) {
            actualOutUi = Number(post.uiTokenAmount.uiAmount ?? 0) - Number(pre?.uiTokenAmount?.uiAmount ?? 0);
            fillSource = 'on_chain';
          } else if (side === 'sell') {
            const keys = tx.result.transaction?.message?.accountKeys || [];
            const idx = keys.findIndex((k) => (typeof k === 'string' ? k : k?.pubkey) === owner);
            if (idx >= 0) {
              actualOutUi = (meta.postBalances[idx] - meta.preBalances[idx]) / 1e9; // SOL received (net of fee)
              fillSource = 'on_chain';
            }
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    setIntent(intent_id, 'CONFIRMED', { signature: txSig, actual_out_ui: actualOutUi, fill_source: fillSource });
    safeAudit({ audit_scope: 'intent', audit_reason: 'live_tx_confirmed', detail: { intent_id, signature: txSig, actual_out_ui: actualOutUi, fill_source: fillSource } });

    return {
      ok: true, signature: txSig, intent_id,
      outUi: actualOutUi, fillSource,
      priceImpactPct: q.priceImpactPct,
      solPriceUsd: price,
      proceedsUsd: side === 'sell' ? actualOutUi * price : undefined,
    };
  }

  function intents(limit = 50) {
    const l = ledger();
    return Object.entries(l.intents).slice(-limit).map(([id, v]) => ({ intent_id: id, ...v }));
  }

  // Serialize the CRITICAL section of real-money swaps (gates→claim→send→recordSigned): the
  // signer notional cap is a check-then-act across an awaited send, so two concurrent calls
  // (leader stream + TP/SL loop) could otherwise both pass canSignNow against a stale total.
  // The lock is released right after recordSigned (see releaseLock), so the long confirmation
  // poll runs UNLOCKED and never starves another swap (e.g. a stop-loss) behind it.
  let execLock = Promise.resolve();
  function executeSwap(args) {
    let release = () => {};
    const myTurn = new Promise((r) => { release = r; });
    const prev = execLock;
    execLock = myTurn;
    return (async () => {
      await prev.catch(() => {});
      try { return await executeSwapInner(args, release); }
      finally { release(); } // safety net for paths that return before recordSigned
    })();
  }

  return { executeSwap, gates, intents, solPriceUsd, _internal: { intentIdFor, claimIntent, setIntent, solPriceUsd } };
}
