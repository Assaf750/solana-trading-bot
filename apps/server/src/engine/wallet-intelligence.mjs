// wallet-intelligence.mjs — PURE copy-trading intelligence layer over the wallet read-model
// (computeWalletStats output) + raw swap events. Produces a classification, copyability tier,
// and a set of 0..100 scores with honest reasons. Heuristic by nature (no per-trade market
// reference) — confidence is reported and unknowns are null, never faked. No I/O.

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const stddev = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

/**
 * @param stats  computeWalletStats() output
 * @param events optional [{kind:'buy'|'sell', quoteSol, ts}] for trade-size analysis
 */
export function assessCopyability({ stats, events = [] } = {}) {
  const tc = stats?.trades_closed || 0;
  const insufficient = !stats || stats.status === 'insufficient_evidence' || tc < 3;
  const nullScores = { copyability: null, latency_sensitivity: null, liquidity_compatibility: null, entry_quality: null, exit_quality: null, risk_compatibility: null, consistency: null };
  if (insufficient) {
    return {
      tier: 'insufficient_data', classification: 'insufficient', confidence: 'low',
      scores: nullScores, flags: { wash_trading: false, fake_profit: false, dev_suspect: false },
      profit_source: 'unknown', risks: { crowd_following: null, adverse_selection: null },
      reasons: [{ severity: 'info', code: 'insufficient_history', text: `Only ${tc} closed trades in the scanned window — not enough to judge.` }],
    };
  }

  const wr = stats.win_rate ?? 0;
  const hold = stats.avg_hold_seconds ?? 0;
  const flip = stats.bot_signals?.rapid_flip_ratio ?? 0;
  const soldGtBought = stats.bot_signals?.sold_more_than_bought_tokens ?? 0;
  const netPos = (stats.realized_pnl_sol ?? 0) > 0;
  const dist = Object.fromEntries((stats.outcome_distribution || []).map((b) => [b.key, b.count]));
  const catastrophic = dist.lt_neg50 || 0;
  const bigWins = (dist.gt_500 || 0) + (dist.b_200_500 || 0);
  const reasons = [];
  const add = (severity, code, text) => reasons.push({ severity, code, text });

  // latency sensitivity (higher = the wallet acts so fast a copier fills worse)
  let latency = 20;
  if (hold > 0) { if (hold < 30) latency = 90; else if (hold < 120) latency = 70; else if (hold < 600) latency = 45; else if (hold < 3600) latency = 30; else latency = 15; }
  latency = clamp(latency + flip * 40);

  // flags
  const wash_trading = flip >= 0.4;
  const dev_suspect = soldGtBought >= 2 || (soldGtBought >= 1 && (stats.distinct_tokens || 0) <= 2);
  const fake_profit = netPos && soldGtBought >= 2;
  if (wash_trading) add('high', 'wash_suspect', `High rapid flip ratio (${(flip * 100).toFixed(0)}%) — possible wash/bot activity.`);
  if (dev_suspect) add('high', 'dev_suspect', `Sold tokens it never bought in-window (${soldGtBought}) — possible dev/airdrop dumper.`);
  if (fake_profit) add('high', 'fake_profit', 'Net-positive while dumping un-bought tokens — profit may not be reproducible by a copier.');

  // quality scores
  const entry_quality = clamp(40 + wr * 40 + Math.min(20, bigWins * 5));
  const exit_quality = clamp(50 + (tc ? (bigWins / tc) * 30 : 0) - (tc ? (catastrophic / tc) * 40 : 0));
  const risk_compatibility = clamp(100 - (tc ? (catastrophic / tc) * 100 : 0) - (wash_trading ? 20 : 0));
  const consistency = clamp(wr * 100 * Math.min(1, tc / 10));

  // liquidity compatibility from buy-size consistency (needs events)
  let liquidity_compatibility = null; let typical_trade_sol = null;
  const buys = (events || []).filter((e) => e?.kind === 'buy' && Number.isFinite(e.quoteSol) && e.quoteSol > 0).map((e) => Math.abs(e.quoteSol));
  if (buys.length >= 3) { typical_trade_sol = Math.round(median(buys) * 1e4) / 1e4; const cv = stddev(buys) / (mean(buys) || 1); liquidity_compatibility = clamp(100 - Math.min(100, cv * 60)); }

  // copyability composite
  const copyability = clamp(wr * 45 + (netPos ? 15 : 0) + (100 - latency) * 0.25 + entry_quality * 0.1 + exit_quality * 0.1 - (wash_trading ? 25 : 0) - (dev_suspect ? 25 : 0) - (fake_profit ? 20 : 0));

  // classification
  let classification = 'noise';
  if (hold > 0 && hold < 60 && flip >= 0.2) classification = 'sniper';
  else if (dev_suspect) classification = 'dev_suspect';
  else if (tc >= 5 && wr >= 0.5 && netPos) classification = 'smart_money';

  if (classification === 'sniper') add('med', 'sniper', `Very fast holder (avg hold ${Math.round(hold)}s) — latency-sensitive, hard to copy profitably.`);
  if (classification === 'smart_money') add('low', 'smart_money', `Consistent edge: ${(wr * 100).toFixed(0)}% win-rate over ${tc} closed trades, net positive.`);
  if (catastrophic && tc && catastrophic / tc >= 0.3) add('med', 'heavy_losses', `${catastrophic}/${tc} trades lost > 50%.`);

  // profit source
  let profit_source = 'unclear';
  if (soldGtBought >= 2) profit_source = 'airdrop_or_dump';
  else if (hold > 0 && hold < 120) profit_source = 'flipping';
  else if (wr >= 0.5 && netPos) profit_source = 'swing';

  const adverse_selection = latency; // you fill after a fast wallet
  const crowd_following = clamp(30 + (classification === 'smart_money' ? 20 : 0));

  // copyability tier
  let tier;
  if (wash_trading || fake_profit) tier = 'banned';
  else if (dev_suspect || !netPos || latency >= 80) tier = 'degraded';
  else if (copyability >= 65 && wr >= 0.5) tier = 'copy_allowed';
  else if (copyability >= 45) tier = 'watch_only';
  else tier = 'candidate';

  return {
    tier, classification, confidence: tc >= 8 ? 'medium' : 'low',
    scores: { copyability, latency_sensitivity: latency, liquidity_compatibility, entry_quality, exit_quality, risk_compatibility, consistency },
    typical_trade_sol,
    flags: { wash_trading, fake_profit, dev_suspect },
    profit_source,
    risks: { crowd_following, adverse_selection },
    reasons,
  };
}
