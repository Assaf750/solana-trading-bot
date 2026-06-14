// paper-engine.test.mjs — engine correctness: swap detection, FIFO P&L, risk gates,
// and the full paper pipeline with mocked market (no network in tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-eng-'));

const { detectLeaderSwap, WSOL_MINT } = await import('../src/engine/swap-detector.mjs');
const { isHeliusHost, buildWalletSubscriptions, parseStreamNotification } = await import('../src/engine/rpc-client.mjs');
const { computeWalletStats } = await import('../src/engine/wallet-analyzer.mjs');
const { extractTradersFromTx } = await import('../src/engine/wallet-discovery.mjs');
const { createPaperPortfolio } = await import('../src/engine/paper-portfolio.mjs');
const { checkEntryGates } = await import('../src/engine/risk-gates.mjs');
const { createPaperEngine } = await import('../src/engine/paper-engine.mjs');
const { createConfigService, HARD_RISK_FIELDS } = await import('../src/config-service.mjs');
const { createWalletRegistry } = await import('../src/wallet-registry.mjs');
const { createKillSwitch } = await import('../src/kill-switch.mjs');
const { createOperatingState } = await import('../src/operating-state.mjs');

const LEADER = 'LeAdEr111111111111111111111111111111111111';
const MEME = 'MemeCoinMint11111111111111111111111111111111';

function txFixture({ preMeme = 0, postMeme = 0, preSol = 10e9, postSol = 9e9, failed = false }) {
  return {
    transaction: { message: { accountKeys: [{ pubkey: LEADER }, { pubkey: 'other' }] } },
    meta: {
      err: failed ? { InstructionError: [] } : null,
      preBalances: [preSol, 0],
      postBalances: [postSol, 0],
      preTokenBalances: preMeme > 0 ? [{ owner: LEADER, mint: MEME, uiTokenAmount: { uiAmount: preMeme, decimals: 6 } }] : [],
      postTokenBalances: postMeme > 0 ? [{ owner: LEADER, mint: MEME, uiTokenAmount: { uiAmount: postMeme, decimals: 6 } }] : [],
    },
  };
}

// ---------- swap detection ----------
test('swap-detector: leader spends SOL, receives token => BUY', () => {
  const r = detectLeaderSwap({ tx: txFixture({ postMeme: 50000 }), leaderAddress: LEADER });
  assert.equal(r.kind, 'buy');
  assert.equal(r.mint, MEME);
  assert.equal(r.uiDelta, 50000);
});

test('swap-detector: leader sells part => SELL partial with fraction', () => {
  const r = detectLeaderSwap({ tx: txFixture({ preMeme: 50000, postMeme: 25000, preSol: 9e9, postSol: 9.5e9 }), leaderAddress: LEADER });
  assert.equal(r.kind, 'sell');
  assert.equal(r.fullExit, false);
  assert.ok(Math.abs(r.soldFraction - 0.5) < 1e-9);
});

test('swap-detector: leader sells all (account closed) => full exit', () => {
  const r = detectLeaderSwap({ tx: txFixture({ preMeme: 50000, postMeme: 0, preSol: 9e9, postSol: 9.9e9 }), leaderAddress: LEADER });
  assert.equal(r.kind, 'sell');
  assert.equal(r.fullExit, true);
});

test('swap-detector: failed tx / no movement / hostile input => null, never throws', () => {
  assert.equal(detectLeaderSwap({ tx: txFixture({ postMeme: 100, failed: true }), leaderAddress: LEADER }).kind, null);
  assert.equal(detectLeaderSwap({ tx: txFixture({}), leaderAddress: LEADER }).kind, null);
  assert.equal(detectLeaderSwap({ tx: null, leaderAddress: LEADER }).kind, null);
  assert.equal(detectLeaderSwap({ tx: { meta: { get err() { throw new Error('hostile'); } } }, leaderAddress: LEADER }).kind, null);
});

// ---------- Helius stream integration (pure helpers) ----------
test('rpc-client: Helius host detected; generic host not', () => {
  assert.equal(isHeliusHost('https://mainnet.helius-rpc.com/?api-key=x'), true);
  assert.equal(isHeliusHost('https://api.mainnet-beta.solana.com'), false);
  assert.equal(isHeliusHost('not a url'), false);
});

test('rpc-client: default subscription is per-wallet logsSubscribe (reliable on every plan)', () => {
  const addrs = ['Aaa', 'Bbb', 'Ccc'];
  const def = buildWalletSubscriptions({ addresses: addrs });
  assert.equal(def.length, 3);
  assert.ok(def.every((s) => s.method === 'logsSubscribe'));
  assert.deepEqual(def[0].params[0].mentions, ['Aaa']);
  // enhanced is opt-in only (Helius paid Atlas endpoint)
  const enhanced = buildWalletSubscriptions({ addresses: addrs, enhanced: true });
  assert.equal(enhanced.length, 1);
  assert.equal(enhanced[0].method, 'transactionSubscribe');
  assert.deepEqual(enhanced[0].params[0].accountInclude, addrs);
});

test('rpc-client: parseStreamNotification extracts inline tx (Helius) and signature-only (logs), drops failed/garbage', () => {
  const heliusMsg = { method: 'transactionNotification', params: { result: { value: { signature: 'SIG1', transaction: { transaction: { message: {} }, meta: { err: null } } } } } };
  const p1 = parseStreamNotification(heliusMsg);
  assert.equal(p1.signature, 'SIG1');
  assert.ok(p1.tx, 'inline tx present for Helius');
  const failed = { method: 'transactionNotification', params: { result: { value: { signature: 'SIG2', transaction: { meta: { err: { x: 1 } } } } } } };
  assert.equal(parseStreamNotification(failed), null, 'failed tx dropped');
  const logsMsg = { method: 'logsNotification', params: { result: { value: { signature: 'SIG3', err: null } } } };
  const p3 = parseStreamNotification(logsMsg);
  assert.equal(p3.signature, 'SIG3');
  assert.equal(p3.tx, null, 'logs path has no inline tx');
  assert.equal(parseStreamNotification({ method: 'unknown' }), null);
});

// ---------- wallet analyzer (pure historical read-model) ----------
test('wallet-analyzer: empty / no-evidence -> insufficient_evidence, never fabricates', () => {
  assert.equal(computeWalletStats([]).status, 'insufficient_evidence');
  assert.equal(computeWalletStats(null).status, 'insufficient_evidence');
});

test('wallet-analyzer: FIFO realized PnL, win rate, outcome buckets from real-shaped events', () => {
  const ev = [
    // token X: buy 100 @ 1 SOL, sell 100 @ 2 SOL  => +1 SOL, +100% => win, bucket 0-200
    { kind: 'buy', mint: 'X', qtyUi: 100, quoteSol: 1, ts: 1000 },
    { kind: 'sell', mint: 'X', qtyUi: 100, quoteSol: 2, ts: 1100 },
    // token Y: buy 50 @ 2 SOL, sell 50 @ 0.5 SOL => -1.5 SOL, -75% => loss, bucket <-50
    { kind: 'buy', mint: 'Y', qtyUi: 50, quoteSol: 2, ts: 2000 },
    { kind: 'sell', mint: 'Y', qtyUi: 50, quoteSol: 0.5, ts: 2500 },
  ];
  const s = computeWalletStats(ev, { solPriceUsd: 200 });
  assert.equal(s.trades_closed, 2);
  assert.equal(s.win_rate, 0.5);
  assert.ok(Math.abs(s.realized_pnl_sol - (-0.5)) < 1e-9, `realized ${s.realized_pnl_sol}`);
  assert.equal(s.realized_pnl_usd, -100);
  const dist = Object.fromEntries(s.outcome_distribution.map((b) => [b.key, b.count]));
  assert.equal(dist.b_0_200, 1);
  assert.equal(dist.lt_neg50, 1);
  assert.equal(s.provenance, 'on_chain');
});

test('wallet-analyzer: partial FIFO sell + rapid-flip + sold>bought bot signals', () => {
  const ev = [
    { kind: 'buy', mint: 'Z', qtyUi: 100, quoteSol: 10, ts: 100 },
    { kind: 'sell', mint: 'Z', qtyUi: 50, quoteSol: 8, ts: 103 }, // within 5s of buy -> rapid flip; sell half: cost 5, proceeds 8 -> +3
    { kind: 'sell', mint: 'W', qtyUi: 10, quoteSol: 1, ts: 200 }, // sold with no prior buy -> sold>bought
  ];
  const s = computeWalletStats(ev);
  assert.equal(s.trades_closed, 1, 'only the matched Z sell closes');
  assert.equal(s.bot_signals.rapid_buy_sell_within_5s, 1);
  assert.equal(s.bot_signals.sold_more_than_bought_tokens, 1);
});

// ---------- wallet discovery (pure extractor) ----------
test('wallet-discovery: extracts distinct trader owners for the mint, ignores other mints + failed tx', () => {
  const MINT = 'MemeMint1111111111111111111111111111111111';
  const tx = {
    meta: {
      err: null,
      preTokenBalances: [{ owner: 'WALLET_A', mint: MINT, uiTokenAmount: { uiAmount: 0 } }],
      postTokenBalances: [
        { owner: 'WALLET_A', mint: MINT, uiTokenAmount: { uiAmount: 100 } }, // bought
        { owner: 'WALLET_B', mint: MINT, uiTokenAmount: { uiAmount: 50 } },  // appeared (bought)
        { owner: 'WALLET_C', mint: 'OtherMint', uiTokenAmount: { uiAmount: 9 } }, // different mint -> ignored
      ],
    },
  };
  const traders = extractTradersFromTx(tx, MINT).sort();
  assert.deepEqual(traders, ['WALLET_A', 'WALLET_B']);
  assert.deepEqual(extractTradersFromTx({ meta: { err: { x: 1 } } }, MINT), []);
  assert.deepEqual(extractTradersFromTx(null, MINT), []);
});

// ---------- portfolio ----------
test('portfolio: entry -> mark -> partial exit -> full exit, FIFO P&L correct', () => {
  const pf = createPaperPortfolio();
  const pos = pf.recordEntry({
    leader_address: LEADER, wallet_id: 'w_1', token_mint: MEME,
    qty_ui: 1000, decimals: 6, cost_usd: 100, fee_usd_est: 0.05, price_impact_pct: 0.4,
    copy_mode: 'full_mirror', tp_pct: 50, sl_pct: 30,
  });
  assert.equal(pf.openCount(), 1);
  // sell half for 80 USD => realized = 80 - 50(cost half) - 0.05 = 29.95
  const r1 = pf.recordExit({ position_id: pos.position_id, fraction: 0.5, proceeds_usd: 80, fee_usd_est: 0.05, reason: 'leader_partial_sell_mirrored' });
  assert.equal(r1.ok, true);
  assert.ok(Math.abs(r1.realized_usd - 29.95) < 1e-9);
  assert.equal(r1.closed, false);
  // sell rest for 40 => realized = 40 - 50 - 0.05 = -10.05
  const r2 = pf.recordExit({ position_id: pos.position_id, fraction: 1, proceeds_usd: 40, fee_usd_est: 0.05, reason: 'leader_full_exit_mirrored' });
  assert.equal(r2.closed, true);
  assert.ok(Math.abs(r2.realized_usd - -10.05) < 1e-9);
  const s = pf.summary();
  assert.equal(s.simulated, true);
  assert.ok(Math.abs(s.realized_pnl_usd - 19.9) < 0.01);
  assert.equal(s.open_positions, 0);
});

// ---------- risk gates ----------
function fullCfg(overrides = {}) {
  return {
    hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, f === 'max_open_positions' ? 2 : f === 'max_daily_loss_usdt' ? 50 : 10])),
    execution: { capital_limit: 1000, sizing_mode: 'fixed_usd', sizing_value: 10 },
    ...overrides,
  };
}
const emptyPf = { openCount: () => 0, tokenExposureUsd: () => 0, dailyRealized: () => 0 };

test('risk-gates: clean config + ACTIVE => allowed', () => {
  const r = checkEntryGates({ cfg: fullCfg(), portfolio: emptyPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' });
  assert.equal(r.allowed, true);
});

test('risk-gates: missing hard-risk field => fail-safe reject (no implicit infinity)', () => {
  const cfg = fullCfg();
  cfg.hard_risk.max_token_exposure_pct = null;
  const r = checkEntryGates({ cfg, portfolio: emptyPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' });
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.some((x) => x.startsWith('hard_risk_incomplete')));
});

test('risk-gates: kill switch / non-ACTIVE / size / exposure / daily loss each block', () => {
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: emptyPf, sizeUsd: 10, tokenMint: MEME, killBlocked: true, operatingState: 'ACTIVE' }).allowed, false);
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: emptyPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'EXITS_ONLY' }).allowed, false);
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: emptyPf, sizeUsd: 200, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' }).allowed, false, 'size > 10% of 1000');
  const richPf = { ...emptyPf, tokenExposureUsd: () => 95 };
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: richPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' }).allowed, false, 'exposure 105 > 100');
  const losingPf = { ...emptyPf, dailyRealized: () => -60 };
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: losingPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' }).allowed, false, 'daily loss 60 > 50');
  const maxedPf = { ...emptyPf, openCount: () => 2 };
  assert.equal(checkEntryGates({ cfg: fullCfg(), portfolio: maxedPf, sizeUsd: 10, tokenMint: MEME, killBlocked: false, operatingState: 'ACTIVE' }).allowed, false, 'max positions');
});

// ---------- full paper pipeline with mocked market ----------
test('paper pipeline E2E: leader buy -> gates -> feasibility -> paper fill; bad route rejected', async () => {
  const config = createConfigService();
  config.update({
    hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, f === 'max_open_positions' ? 5 : f === 'max_daily_loss_usdt' ? 100 : 25])),
    execution: { capital_limit: 1000, sizing_value: 10 },
  });
  const walletsRegistry = createWalletRegistry();
  const reg = walletsRegistry.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs1'.slice(0, 44), label: 'L' });
  const w = reg.ok ? reg.wallet : walletsRegistry.list()[0];
  walletsRegistry.setFollow(w.wallet_id, true);
  const killSwitch = createKillSwitch();
  killSwitch.disengage({ level: 'global' });
  const operatingState = createOperatingState();
  operatingState.transition('WARMING_UP', 't'); operatingState.transition('ACTIVE', 't');
  const portfolio = createPaperPortfolio();

  let routeHealthy = true;
  const jupiter = {
    paperBuy: async ({ sizeUsd }) => routeHealthy
      ? { ok: true, outAmountBase: 5_000_000_000, priceImpactPct: 0.3 } // 5000 tokens @6dp
      : { ok: false, error: 'quote_no_route' },
    usdValueOf: async () => routeHealthy ? { ok: true, usd: 9.6, priceImpactPct: 0.5 } : { ok: false, error: 'quote_no_route' },
  };
  // rpc mock returns a SAFE mint (authorities revoked) so the anti-rug screen passes
  const safeMintRpc = { rpc: async (m) => (m === 'getAccountInfo'
    ? { ok: true, result: { value: { data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null } } } } } }
    : { ok: true, result: null }) };
  const engine = createPaperEngine({
    config, walletsRegistry, killSwitch, operatingState, vault: { isUnlocked: () => true, getSecretForUse: () => ({ ok: true, value: 'http://x' }) },
    portfolio, rpc: safeMintRpc, jupiter, audit: () => {}, broadcast: () => {},
  });

  const before = portfolio.openCount();
  await engine._internal.handleLeaderBuy({
    leader: w.tracked_wallet_address, wallet: w,
    swap: { kind: 'buy', mint: MEME, uiDelta: 100, post: 100, decimals: 6 },
  });
  assert.equal(portfolio.openCount(), before + 1, 'paper position opened');
  const pos = portfolio.openPositions().at(-1);
  assert.equal(pos.simulated, true);
  assert.equal(pos.cost_usd, 10);

  // route dies => next entry rejected on feasibility, no new position
  routeHealthy = false;
  await engine._internal.handleLeaderBuy({
    leader: w.tracked_wallet_address, wallet: w,
    swap: { kind: 'buy', mint: 'OtherMint1111111111111111111111111111111111', uiDelta: 1, post: 1, decimals: 6 },
  });
  assert.equal(portfolio.openCount(), before + 1, 'no entry without a sell route');
  const evs = engine.events(10);
  assert.ok(evs.some((e) => e.kind === 'entry_rejected' && e.rejections.some((x) => String(x).startsWith('route_invalid') || String(x).startsWith('exit_feasibility_fail'))));
});

test('paper pipeline: follow_entry_user_exit ignores leader sells (risk modifier only)', async () => {
  const config = createConfigService();
  const walletsRegistry = createWalletRegistry();
  const w = walletsRegistry.list()[0];
  const portfolio = createPaperPortfolio();
  const engine = createPaperEngine({
    config, walletsRegistry, killSwitch: createKillSwitch(), operatingState: createOperatingState(),
    vault: { isUnlocked: () => true }, portfolio, rpc: {},
    jupiter: { usdValueOf: async () => ({ ok: true, usd: 1 }) }, audit: () => {}, broadcast: () => {},
  });
  const openBefore = portfolio.openCount();
  await engine._internal.handleLeaderSell({
    leader: w.tracked_wallet_address, wallet: { ...w, copy_mode: 'follow_entry_user_exit' },
    swap: { kind: 'sell', mint: MEME, fullExit: true, soldFraction: 1 },
  });
  assert.equal(portfolio.openCount(), openBefore, 'no forced exit in follow_entry mode');
});

// ---------- feature 2: late-entry drift guard + leader-sell front-run ----------
test('swap-detector: a buy exposes quoteSpentSol/Usdc for fill-price reconstruction', () => {
  const s = detectLeaderSwap({ tx: txFixture({ postMeme: 1000, preSol: 10e9, postSol: 9e9 }), leaderAddress: LEADER });
  assert.equal(s.kind, 'buy');
  assert.equal(s.quoteSpentSol, 1);   // spent 1 SOL
  assert.equal(s.quoteSpentUsdc, 0);
});

function fullConfig() {
  const config = createConfigService();
  config.update({
    hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, f === 'max_open_positions' ? 5 : f === 'max_daily_loss_usdt' ? 100 : 25])),
    execution: { capital_limit: 1000, sizing_value: 10 },
  });
  return config;
}
const safeMintRpc = () => ({ rpc: async (m) => (m === 'getAccountInfo'
  ? { ok: true, result: { value: { data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null } } } } } }
  : { ok: true, result: null }) });
function activeState() { const o = createOperatingState(); o.transition('WARMING_UP', 't'); o.transition('ACTIVE', 't'); return o; }
function liveKill() { const k = createKillSwitch(); k.disengage({ level: 'global' }); return k; }

// leader bought 1000 tokens for 1 SOL; at $150/SOL => leader fill price = $0.15/token
const BUY = { kind: 'buy', mint: MEME, uiDelta: 1000, post: 1000, decimals: 6, quoteSpentSol: 1, quoteSpentUsdc: 0 };
function driftEngine(file, ourPx) {
  const portfolio = createPaperPortfolio({ file });
  const jupiter = {
    quote: async () => ({ ok: true, outAmount: 150 * 1e6 }),                                   // WSOL->USDC => $150/SOL
    paperBuy: async ({ sizeUsd }) => ({ ok: true, outAmountBase: Math.round((sizeUsd / ourPx) * 1e6), priceImpactPct: 0.3 }),
    usdValueOf: async ({ qtyUi }) => ({ ok: true, usd: qtyUi * ourPx, priceImpactPct: 0.5 }),
  };
  const engine = createPaperEngine({
    config: fullConfig(), walletsRegistry: createWalletRegistry(), killSwitch: liveKill(), operatingState: activeState(),
    vault: { isUnlocked: () => true, getSecretForUse: () => ({ ok: true, value: 'http://x' }) },
    portfolio, rpc: safeMintRpc(), jupiter, audit: () => {}, broadcast: () => {},
  });
  return { engine, portfolio };
}

test('drift guard: SKIPS a late entry when price ran past the leader fill', async () => {
  const { engine, portfolio } = driftEngine('pf-drift-skip.json', 0.30); // 100% above leader's $0.15
  const wallet = { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: { max_entry_drift_pct: 20, drift_action: 'skip' } };
  const before = portfolio.openCount();
  await engine._internal.handleLeaderBuy({ leader: LEADER, wallet, swap: BUY });
  assert.equal(portfolio.openCount(), before, 'no position opened on a late entry');
  assert.ok(engine.events(10).some((e) => e.kind === 'entry_skipped_late_entry'));
});

test('drift guard: SHRINKS size on a late entry when action=shrink', async () => {
  const { engine, portfolio } = driftEngine('pf-drift-shrink.json', 0.30); // 100% drift -> factor 20/100 -> $2
  const wallet = { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: { max_entry_drift_pct: 20, drift_action: 'shrink' } };
  await engine._internal.handleLeaderBuy({ leader: LEADER, wallet, swap: BUY });
  const pos = portfolio.openPositions().at(-1);
  assert.ok(pos, 'position opened (shrunk)');
  assert.ok(Math.abs(pos.cost_usd - 2) < 0.05, `size shrunk to ~(threshold/drift)*sizeUsd = ~2, got ${pos.cost_usd}`);
  assert.ok(engine.events(10).some((e) => e.kind === 'entry_drift_shrunk'));
});

test('drift guard: ALLOWS entry within the drift threshold', async () => {
  const { engine, portfolio } = driftEngine('pf-drift-ok.json', 0.165); // 10% drift < 20% threshold
  const wallet = { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: { max_entry_drift_pct: 20 } };
  const before = portfolio.openCount();
  await engine._internal.handleLeaderBuy({ leader: LEADER, wallet, swap: BUY });
  assert.equal(portfolio.openCount(), before + 1, 'entry allowed within threshold');
  assert.equal(portfolio.openPositions().at(-1).cost_usd, 10);
});

test('leader-sell front-run: exits in follow_entry mode when exit_on_leader_sell=true', async () => {
  const portfolio = createPaperPortfolio({ file: 'pf-frontrun.json' });
  portfolio.recordEntry({ leader_address: LEADER, wallet_id: 'w1', token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
  const engine = createPaperEngine({
    config: fullConfig(), walletsRegistry: createWalletRegistry(), killSwitch: liveKill(), operatingState: activeState(),
    vault: { isUnlocked: () => true }, portfolio, rpc: safeMintRpc(),
    jupiter: { usdValueOf: async () => ({ ok: true, usd: 12, priceImpactPct: 0.5 }) }, audit: () => {}, broadcast: () => {},
  });
  const wallet = { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: { exit_on_leader_sell: true } };
  const before = portfolio.openCount();
  await engine._internal.handleLeaderSell({ leader: LEADER, wallet, swap: { kind: 'sell', mint: MEME, fullExit: true, soldFraction: 1 } });
  assert.equal(portfolio.openCount(), before - 1, 'position exited (front-run) on leader sell');
  assert.ok(engine.events(10).some((e) => e.kind === 'leader_sell_frontrun_exit'));
});

test('leader-sell front-run: default OFF still ignores leader sells in follow_entry mode', async () => {
  const portfolio = createPaperPortfolio({ file: 'pf-nofrontrun.json' });
  portfolio.recordEntry({ leader_address: LEADER, wallet_id: 'w1', token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
  const engine = createPaperEngine({
    config: fullConfig(), walletsRegistry: createWalletRegistry(), killSwitch: liveKill(), operatingState: activeState(),
    vault: { isUnlocked: () => true }, portfolio, rpc: safeMintRpc(),
    jupiter: { usdValueOf: async () => ({ ok: true, usd: 12 }) }, audit: () => {}, broadcast: () => {},
  });
  const wallet = { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: {} };
  const before = portfolio.openCount();
  await engine._internal.handleLeaderSell({ leader: LEADER, wallet, swap: { kind: 'sell', mint: MEME, fullExit: true, soldFraction: 1 } });
  assert.equal(portfolio.openCount(), before, 'no exit by default in follow_entry mode');
});

// ---------- feature 3: analytics -> engine (EV gate + auto-pause) ----------
function engineWith(config, portfolio, walletsRegistry = createWalletRegistry(), jupiterOverride) {
  const jupiter = jupiterOverride || {
    quote: async () => ({ ok: true, outAmount: 150 * 1e6 }),
    paperBuy: async ({ sizeUsd }) => ({ ok: true, outAmountBase: Math.round((sizeUsd / 0.15) * 1e6), priceImpactPct: 0.3 }),
    usdValueOf: async ({ qtyUi }) => ({ ok: true, usd: qtyUi * 0.15, priceImpactPct: 0.5 }),
  };
  return createPaperEngine({
    config, walletsRegistry, killSwitch: liveKill(), operatingState: activeState(),
    vault: { isUnlocked: () => true, getSecretForUse: () => ({ ok: true, value: 'http://x' }) },
    portfolio, rpc: safeMintRpc(), jupiter, audit: () => {}, broadcast: () => {},
  });
}
// seed CLOSED positions for a leader by recording an entry then a full exit at cost+realized
function seedClosed(portfolio, leader, walletId, realizedList) {
  for (const realized of realizedList) {
    const pos = portfolio.recordEntry({ leader_address: leader, wallet_id: walletId, token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
    portfolio.recordExit({ position_id: pos.position_id, fraction: 1, proceeds_usd: 10 + realized, fee_usd_est: 0, reason: 'seed' });
  }
}

test('EV gate: blocks entries from a leader failing thresholds (strict)', async () => {
  const config = fullConfig();
  config.update({ ev: { ev_gate_mode: 'strict', minimum_sample_size: 5, minimum_profit_factor: 1.5, minimum_exit_success_rate: 0.5, minimum_net_expectancy: 0 } });
  const portfolio = createPaperPortfolio({ file: 'pf-ev-block.json' });
  seedClosed(portfolio, LEADER, 'w1', [-5, -5, -5, -5, -5]); // 5 losses -> PF 0, win_rate 0
  const engine = engineWith(config, portfolio);
  const before = portfolio.openCount();
  await engine._internal.handleLeaderBuy({ leader: LEADER, wallet: { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: {} }, swap: BUY });
  assert.equal(portfolio.openCount(), before, 'entry blocked by the EV gate');
  assert.ok(engine.events(10).some((e) => e.kind === 'entry_rejected' && e.rejections.some((x) => x.startsWith('ev_gate'))));
});

test('EV gate: allows a leader meeting thresholds', async () => {
  const config = fullConfig();
  config.update({ ev: { ev_gate_mode: 'strict', minimum_sample_size: 5, minimum_profit_factor: 1.5, minimum_exit_success_rate: 0.5, minimum_net_expectancy: 0 } });
  const portfolio = createPaperPortfolio({ file: 'pf-ev-ok.json' });
  seedClosed(portfolio, LEADER, 'w1', [10, 10, 10, -5, 10]); // PF=40/5=8, win_rate 0.8
  const engine = engineWith(config, portfolio);
  const before = portfolio.openCount();
  await engine._internal.handleLeaderBuy({ leader: LEADER, wallet: { wallet_id: 'w1', copy_mode: 'follow_entry_user_exit', config: {} }, swap: BUY });
  assert.equal(portfolio.openCount(), before + 1, 'quality leader allowed');
});

test('auto-pause: unfollows a leader after N consecutive losing exits', async () => {
  const config = fullConfig();
  config.update({ copy_defaults: { auto_pause_after_losses: 3 } });
  const portfolio = createPaperPortfolio({ file: 'pf-autopause.json' });
  const walletsRegistry = createWalletRegistry();
  const reg = walletsRegistry.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs1', label: 'L' });
  const w = reg.ok ? reg.wallet : walletsRegistry.list()[0];
  walletsRegistry.setFollow(w.wallet_id, true);
  seedClosed(portfolio, w.tracked_wallet_address, w.wallet_id, [-5, -5]); // 2 prior losses
  // a losing exit ($5 proceeds on a $10 position) is the 3rd consecutive loss -> pause
  const engine = engineWith(config, portfolio, walletsRegistry, { usdValueOf: async () => ({ ok: true, usd: 5 }) });
  const live = portfolio.recordEntry({ leader_address: w.tracked_wallet_address, wallet_id: w.wallet_id, token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
  const p = portfolio.openPositions().find((x) => x.position_id === live.position_id);
  await engine._internal.performExit({ pf: portfolio, p, fraction: 1, reason: 'stop_loss_hit' });
  assert.equal(walletsRegistry.list().find((x) => x.wallet_id === w.wallet_id).follow_enabled, false, 'leader auto-unfollowed');
  assert.ok(engine.events(10).some((e) => e.kind === 'leader_auto_paused'));
});

test('auto-pause: OFF by default (no threshold) leaves follow untouched', async () => {
  const config = fullConfig();
  config.update({ copy_defaults: { auto_pause_after_losses: null } }); // clear any value leaked via shared config.json
  const portfolio = createPaperPortfolio({ file: 'pf-noautopause.json' });
  const walletsRegistry = createWalletRegistry();
  const w = walletsRegistry.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs1', label: 'L' }).wallet;
  walletsRegistry.setFollow(w.wallet_id, true);
  seedClosed(portfolio, w.tracked_wallet_address, w.wallet_id, [-5, -5, -5]); // many losses, but no threshold set
  const engine = engineWith(config, portfolio, walletsRegistry, { usdValueOf: async () => ({ ok: true, usd: 5 }) });
  const live = portfolio.recordEntry({ leader_address: w.tracked_wallet_address, wallet_id: w.wallet_id, token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
  const p = portfolio.openPositions().find((x) => x.position_id === live.position_id);
  await engine._internal.performExit({ pf: portfolio, p, fraction: 1, reason: 'stop_loss_hit' });
  assert.equal(walletsRegistry.list().find((x) => x.wallet_id === w.wallet_id).follow_enabled, true, 'still followed (auto-pause off)');
});

test('leader-insights: ranks leaders and recommends follow/drop/watch from the bot book', async () => {
  const config = fullConfig();
  config.update({ ev: { minimum_sample_size: 3, minimum_profit_factor: 1.5, minimum_exit_success_rate: 0.5, minimum_net_expectancy: 0 } });
  const portfolio = createPaperPortfolio({ file: 'pf-insights.json' });
  const reg = createWalletRegistry();
  const good = reg.register({ tracked_wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs1', label: 'good' }).wallet;
  const bad = reg.register({ tracked_wallet_address: 'So11111111111111111111111111111111111111112', label: 'bad' }).wallet;
  const thin = reg.register({ tracked_wallet_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', label: 'thin' }).wallet;
  [good, bad, thin].forEach((w) => reg.setFollow(w.wallet_id, true));
  seedClosed(portfolio, good.tracked_wallet_address, good.wallet_id, [10, 10, 10, -5]); // PF 30/5=6 -> follow
  seedClosed(portfolio, bad.tracked_wallet_address, bad.wallet_id, [-5, -5, -5, 2]); // PF 2/15 -> drop
  seedClosed(portfolio, thin.tracked_wallet_address, thin.wallet_id, [10]);          // 1 trade < sample -> watch/follow
  const engine = engineWith(config, portfolio, reg);
  const ins = engine._internal.leaderInsights();
  const by = Object.fromEntries(ins.leaders.map((x) => [x.leader, x])); // key by address (labels can collide via shared registry)
  assert.equal(by[good.tracked_wallet_address].recommendation, 'follow');
  assert.equal(by[bad.tracked_wallet_address].recommendation, 'drop');
  assert.equal(by[good.tracked_wallet_address].profit_factor, 6);
  assert.equal(ins.leaders[0].leader, good.tracked_wallet_address, 'ranked by score, best first');
  assert.ok(ins.recommendation.follow.includes(good.tracked_wallet_address));
  assert.ok(ins.recommendation.drop.includes(bad.tracked_wallet_address));
});

test('mark history: seeded on entry, appends only valid marks, bounded to 48', () => {
  const pf = createPaperPortfolio({ file: 'pf-markhist.json' });
  const pos = pf.recordEntry({ leader_address: LEADER, wallet_id: 'w1', token_mint: MEME, qty_ui: 100, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'follow_entry_user_exit', tp_pct: 50, sl_pct: 30 });
  const seeded = pf.state().positions.find((x) => x.position_id === pos.position_id);
  assert.deepEqual(seeded.mark_history, [10], 'seeded with the entry value');
  for (let i = 1; i <= 60; i += 1) pf.setMark(pos.position_id, 10 + i, 'valid');
  pf.setMark(pos.position_id, 999, 'unavailable'); // stale -> must NOT append
  const p = pf.state().positions.find((x) => x.position_id === pos.position_id);
  assert.ok(p.mark_history.length <= 48, 'bounded');
  assert.equal(p.mark_history[p.mark_history.length - 1], 70, 'last appended is the final valid mark (10+60)');
  assert.ok(!p.mark_history.includes(999), 'stale mark not appended');
});

// ---------- manual trade (sniper mode) ----------
function manualRpc() {
  return { rpc: async (m) => {
    if (m === 'getTokenSupply') return { ok: true, result: { value: { decimals: 6, uiAmount: 1e9 } } };
    if (m === 'getAccountInfo') return { ok: true, result: { value: { data: { parsed: { type: 'mint', info: { mintAuthority: null, freezeAuthority: null } } } } } };
    return { ok: true, result: null };
  } };
}
function manualEngine(file, px = 0.001) {
  const portfolio = createPaperPortfolio({ file });
  const jupiter = {
    quote: async () => ({ ok: true, outAmount: 150e6 }),
    paperBuy: async ({ sizeUsd }) => ({ ok: true, outAmountBase: Math.round((sizeUsd / px) * 1e6), priceImpactPct: 0.2 }),
    usdValueOf: async ({ qtyUi }) => ({ ok: true, usd: qtyUi * px, priceImpactPct: 0.3 }),
  };
  const engine = createPaperEngine({
    config: fullConfig(), walletsRegistry: createWalletRegistry(), killSwitch: liveKill(), operatingState: activeState(),
    vault: { isUnlocked: () => true }, portfolio, rpc: manualRpc(), jupiter, audit: () => {}, broadcast: () => {},
  });
  return { engine, portfolio };
}

test('manual buy: opens a paper position through the gates (leader=MANUAL)', async () => {
  const { engine, portfolio } = manualEngine('pf-manual-buy.json');
  const r = await engine.manualBuy({ mint: MEME, sizeUsd: 10 });
  assert.equal(r.ok, true);
  const pos = portfolio.openPositions().at(-1);
  assert.equal(pos.leader_address, 'MANUAL');
  assert.equal(pos.copy_mode, 'manual');
  assert.equal(pos.cost_usd, 10);
  assert.ok(engine.events(10).some((e) => e.kind === 'manual_entry'));
});

test('manual buy: rejects invalid mint / size before touching the chain', async () => {
  const { engine } = manualEngine('pf-manual-bad.json');
  assert.equal((await engine.manualBuy({ mint: 'bad', sizeUsd: 10 })).error, 'invalid_mint');
  assert.equal((await engine.manualBuy({ mint: MEME, sizeUsd: 0 })).error, 'invalid_size');
  assert.equal((await engine.manualBuy({ mint: MEME, sizeUsd: -5 })).error, 'invalid_size');
});

test('manual buy: respects the hard-risk position-size cap', async () => {
  const { engine, portfolio } = manualEngine('pf-manual-cap.json');
  // cap = 25% of $1000 = $250; a $300 buy must be rejected by the gate
  const r = await engine.manualBuy({ mint: MEME, sizeUsd: 300 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'gates_refused');
  assert.equal(portfolio.openCount(), 0);
});

test('manual sell: partial exit keeps the position open', async () => {
  const { engine, portfolio } = manualEngine('pf-manual-sell.json', 0.001);
  const pos = portfolio.recordEntry({ leader_address: 'MANUAL', wallet_id: 'manual', token_mint: MEME, qty_ui: 1000, decimals: 6, cost_usd: 10, fee_usd_est: 0, price_impact_pct: 0, copy_mode: 'manual', tp_pct: 50, sl_pct: 30 });
  const r = await engine.manualSell({ position_id: pos.position_id, fraction: 0.5 });
  assert.equal(r.ok, true);
  assert.equal(r.closed, false);
  assert.ok(portfolio.openPositions().some((p) => p.position_id === pos.position_id), 'still open after a 50% sell');
});

test('manual sell: unknown position -> not_found', async () => {
  const { engine } = manualEngine('pf-manual-sell-nf.json');
  assert.equal((await engine.manualSell({ position_id: 'nope' })).error, 'position_not_found');
});
