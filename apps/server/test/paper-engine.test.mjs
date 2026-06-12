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
  const engine = createPaperEngine({
    config, walletsRegistry, killSwitch, operatingState, vault: { isUnlocked: () => true, getSecretForUse: () => ({ ok: true, value: 'http://x' }) },
    portfolio, rpc: {}, jupiter, audit: () => {}, broadcast: () => {},
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
