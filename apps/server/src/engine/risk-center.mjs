// risk-center.mjs — PURE aggregation of the system's current risk posture from real state +
// config + the live book. No I/O. Each finding is { area, severity, code, text }; the overall
// posture is derived from the findings. Honest: it reports what the real config/state implies
// (e.g. a disabled anti-rug check, a loose cap, a tripped daily-loss breaker), never invents.
import { HARD_RISK_FIELDS } from '../config-service.mjs';

const SEV_RANK = { block: 0, warn: 1, watch: 2, info: 3, ok: 4 };

export function assessRisk({ status = {}, config = {}, portfolioSummary = {} } = {}) {
  const findings = [];
  const push = (area, severity, code, text) => findings.push({ area, severity, code, text });
  const hr = config.hard_risk || {};
  const safety = config.safety || {};
  const mf = config.market_filters || {};
  const cd = config.copy_defaults || {};
  const blockers = (status?.readiness?.blockers || []).map((b) => b.blocker);

  // --- general posture ---
  if (status?.kill_switch?.global?.engaged !== false && status?.kill_switch) push('general', 'block', 'kill_engaged', 'Kill switch engaged — all trading halted.');
  if (portfolioSummary.entries_blocked) push('general', 'block', 'daily_loss_tripped', 'Daily-loss limit hit — new entries blocked (exits only) until reset.');
  const hrMissing = HARD_RISK_FIELDS.filter((f) => typeof hr[f] !== 'number' || !Number.isFinite(hr[f]));
  if (hrMissing.length) push('general', 'warn', 'hard_risk_incomplete', `${hrMissing.length}/${HARD_RISK_FIELDS.length} hard-risk limits are unset — binding limits incomplete.`);

  // --- token / anti-rug ---
  if (safety.enabled === false) push('token', 'block', 'antirug_disabled', 'Anti-rug screen is DISABLED — ruggable mints can pass entry.');
  else {
    if (safety.require_mint_revoked === false) push('authority', 'warn', 'mint_check_off', 'Mint-authority check is off — inflatable supply can pass.');
    if (safety.require_freeze_revoked === false) push('authority', 'warn', 'freeze_check_off', 'Freeze-authority check is off — freezable tokens can pass.');
    if (safety.block_permanent_delegate === false) push('token2022', 'warn', 'permdelegate_off', 'Token-2022 PermanentDelegate block is off.');
  }

  // --- liquidity / slippage / exit ---
  const slip = cd.max_entry_slippage_vs_leader;
  if (Number.isFinite(slip) && slip >= 10) push('slippage', 'warn', 'high_slippage_allowance', `Entry slippage allowance is high (${slip}%).`);
  if (typeof cd.stop_loss_pct !== 'number' || !Number.isFinite(cd.stop_loss_pct)) push('exit', 'warn', 'no_stop_loss', 'No global stop-loss configured.');
  if (!Number.isFinite(cd.trailing_stop_pct) && !Number.isFinite(cd.tp1_pct)) push('exit', 'info', 'basic_exits_only', 'Only fixed TP/SL configured (no trailing / partial take-profit).');

  // --- concentration / creator ---
  if (Number.isFinite(hr.max_creator_exposure_pct) && hr.max_creator_exposure_pct >= 50) push('concentration', 'watch', 'loose_creator_cap', `Creator/leader exposure cap is loose (${hr.max_creator_exposure_pct}%).`);
  push('concentration', 'info', 'cluster_unenforced', 'Cluster & correlated-meme exposure caps are configured but not yet enforced (no on-chain classification source).');

  // --- data quality / providers ---
  if (blockers.includes('rpc_provider_not_configured')) push('data', 'block', 'no_rpc', 'No RPC provider configured — analyses and trading unavailable.');
  if (status?.vault && !status.vault.vault_unlocked) push('data', 'watch', 'vault_locked', 'Vault is locked — read-only mode; unlock for live data and execution.');
  if (!Number.isFinite(mf.min_fdv_usd) && !Number.isFinite(mf.max_fdv_usd) && !Number.isFinite(mf.min_holders)) push('token', 'info', 'no_market_filters', 'No FDV / min-holders quality filters set (optional, off by default).');

  // --- exit feasibility / network ---
  if (status?.engine?.paper_engine === 'exits_only_stream_gap') push('network', 'warn', 'stream_gap', 'Ingestion stream gap — exits only until it recovers.');

  if (!findings.length) push('general', 'ok', 'all_clear', 'No notable risk signals from the current configuration and state.');

  findings.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
  const posture = findings.some((f) => f.severity === 'block') ? 'blocked'
    : findings.some((f) => f.severity === 'warn') ? 'caution' : 'ok';
  const counts = findings.reduce((m, f) => { m[f.severity] = (m[f.severity] || 0) + 1; return m; }, {});
  return { posture, counts, findings, provenance: 'state+config' };
}
