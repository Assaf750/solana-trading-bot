// @soltrade/risk — hard-risk entry gate (ADR-0001 Phase 2C).
// checkEntryGates is a byte-for-byte port of apps/server engine/risk-gates.mjs (parity): PURE, no
// I/O, no imports; the portfolio is duck-typed in. Hard-Risk limits are binding; any missing limit
// is a fail-safe REJECT (no implicit infinity). The additive helpers (validateHardRiskLimits,
// deriveRiskBudget, normalizeRiskResult, reason codes) are the forward-looking surface; they do not
// change checkEntryGates behaviour.

// The 9 mandatory Hard-Risk limits (SSOT G6). Same set + order as the legacy gate, so the
// `hard_risk_incomplete:<fields>` string is identical.
export const HARD_RISK_REQUIRED_FIELDS = Object.freeze([
  'max_daily_loss_pct', 'max_daily_loss_usdt', 'max_total_drawdown_pct', 'max_open_positions',
  'max_position_size_pct', 'max_token_exposure_pct', 'max_creator_exposure_pct', 'max_cluster_exposure_pct',
  'max_correlated_meme_exposure_pct',
]);

// Static reject reason codes (dynamic-suffixed reasons are documented below). For reference/UX.
export const REJECT_REASON_CODES = Object.freeze([
  'kill_switch_engaged', 'entries_blocked_daily_loss', 'token_blacklisted', 'token_not_whitelisted',
  'capital_limit_missing', 'max_open_positions_reached', 'daily_loss_limit_usdt_hit',
  'daily_loss_limit_pct_hit', 'max_total_drawdown_hit',
  // dynamic: operating_state_<state>_blocks_entry · hard_risk_incomplete:<f|f> ·
  // position_size_<n>_exceeds_<m> · token_exposure_<n>_exceeds_<m> · creator_exposure_<n>_exceeds_<m>
]);

function round2(n) { return Math.round(n * 100) / 100; }

export function checkEntryGates({ cfg, portfolio, sizeUsd, tokenMint, killBlocked, operatingState, entriesBlocked = false, leaderAddress = null }) {
  const rejections = [];

  if (killBlocked) rejections.push('kill_switch_engaged');
  if (operatingState !== 'ACTIVE') rejections.push(`operating_state_${operatingState}_blocks_entry`);
  // once the daily-loss limit trips this book, entries stay blocked for the rest of the day
  if (entriesBlocked) rejections.push('entries_blocked_daily_loss');

  // token allow/deny lists (policy blocks — NOT risk-cap breaches, so they never feed the signer
  // lockout). Blacklist: never buy. Whitelist: if non-empty, only its mints may be bought.
  const lists = cfg.lists || {};
  const blacklist = Array.isArray(lists.token_blacklist) ? lists.token_blacklist : [];
  const whitelist = Array.isArray(lists.token_whitelist) ? lists.token_whitelist : [];
  if (tokenMint && blacklist.includes(tokenMint)) rejections.push('token_blacklisted');
  if (tokenMint && whitelist.length > 0 && !whitelist.includes(tokenMint)) rejections.push('token_not_whitelisted');

  const hr = cfg.hard_risk || {};
  const need = (f) => typeof hr[f] === 'number' && Number.isFinite(hr[f]);

  // Fail-safe: any missing limit blocks entries entirely
  const missing = HARD_RISK_REQUIRED_FIELDS.filter((f) => !need(f));
  if (missing.length) rejections.push(`hard_risk_incomplete:${missing.join('|')}`);

  const capital = cfg.execution?.capital_limit;
  const hasCapital = typeof capital === 'number' && Number.isFinite(capital) && capital > 0;
  if (!hasCapital) rejections.push('capital_limit_missing');

  // `riskRejection` = a GENUINE risk-cap breach (exposure/size/open-count/daily-loss), as
  // opposed to a benign state/config block (kill/pause/EXITS_ONLY/unset-limits). Only the
  // former should feed the signer's consecutive-risk-rejection lockout; counting state
  // blocks would lock the signer during a routine pause and freeze exits.
  let riskRejection = false;
  if (!rejections.length) {
    if (portfolio.openCount() >= hr.max_open_positions) rejections.push('max_open_positions_reached');
    const maxPos = capital * (hr.max_position_size_pct / 100);
    if (sizeUsd > maxPos) rejections.push(`position_size_${sizeUsd}_exceeds_${round2(maxPos)}`);
    const exposure = portfolio.tokenExposureUsd(tokenMint) + sizeUsd;
    const maxToken = capital * (hr.max_token_exposure_pct / 100);
    if (exposure > maxToken) rejections.push(`token_exposure_${round2(exposure)}_exceeds_${round2(maxToken)}`);
    const dailyLoss = -portfolio.dailyRealized();
    if (dailyLoss >= hr.max_daily_loss_usdt) rejections.push('daily_loss_limit_usdt_hit');
    if (dailyLoss >= capital * (hr.max_daily_loss_pct / 100)) rejections.push('daily_loss_limit_pct_hit');
    // total drawdown (realized + open unrealized) vs capital — does NOT reset daily, so it also
    // catches a loss that straddles the UTC daily-reset boundary
    if (Number.isFinite(hr.max_total_drawdown_pct) && typeof portfolio.summary === 'function') {
      const sum = portfolio.summary();
      const drawdownUsd = -((sum.realized_pnl_usd || 0) + (sum.unrealized_pnl_usd || 0));
      if (drawdownUsd >= capital * (hr.max_total_drawdown_pct / 100)) rejections.push('max_total_drawdown_hit');
    }
    // creator/source concentration — proxied by the copied LEADER (no on-chain creator metadata)
    if (leaderAddress && Number.isFinite(hr.max_creator_exposure_pct) && typeof portfolio.leaderExposureUsd === 'function') {
      const leadExp = portfolio.leaderExposureUsd(leaderAddress) + sizeUsd;
      const maxLead = capital * (hr.max_creator_exposure_pct / 100);
      if (leadExp > maxLead) rejections.push(`creator_exposure_${round2(leadExp)}_exceeds_${round2(maxLead)}`);
    }
    // KNOWN GAP: max_cluster_exposure_pct / max_correlated_meme_exposure_pct require token
    // cluster/correlation classification that on-chain reads alone don't provide — they are
    // validated/required for activation but NOT yet enforced here. Do not assume they bind.
    riskRejection = rejections.length > 0; // any push here is a true risk-cap breach
  }

  return { allowed: rejections.length === 0, rejections, riskRejection };
}

// ---- additive risk surface (forward-looking; does not affect checkEntryGates) ----

/** Validate Hard-Risk limit completeness. { ok, missing }. */
export function validateHardRiskLimits(cfg) {
  const hr = (cfg && cfg.hard_risk) || {};
  const need = (f) => typeof hr[f] === 'number' && Number.isFinite(hr[f]);
  const missing = HARD_RISK_REQUIRED_FIELDS.filter((f) => !need(f));
  return { ok: missing.length === 0, missing };
}

/** Normalize a risk result to the canonical shape, fail-closed (allowed only if explicitly so and
 *  no rejections). */
export function normalizeRiskResult(r) {
  if (!r || typeof r !== 'object') return { allowed: false, rejections: ['invalid_risk_result'], riskRejection: false };
  const rejections = Array.isArray(r.rejections) ? r.rejections : [];
  return { allowed: r.allowed === true && rejections.length === 0, rejections, riskRejection: r.riskRejection === true };
}

/** Derive a RiskBudget-shaped object (contracts.RiskBudget) for a token. Fail-closed: an unknown
 *  cap yields within_budget=false. Pure read; does not mutate. */
export function deriveRiskBudget({ cfg, portfolio, sizeUsd = 0, tokenMint = null, scope = null } = {}) {
  const hr = (cfg && cfg.hard_risk) || {};
  const capital = cfg && cfg.execution ? cfg.execution.capital_limit : undefined;
  const hasCapital = typeof capital === 'number' && Number.isFinite(capital) && capital > 0;
  const maxToken = (hasCapital && Number.isFinite(hr.max_token_exposure_pct)) ? capital * (hr.max_token_exposure_pct / 100) : null;
  const used = (portfolio && tokenMint && typeof portfolio.tokenExposureUsd === 'function') ? portfolio.tokenExposureUsd(tokenMint) : 0;
  const projected = used + (Number(sizeUsd) || 0);
  const dailyLoss = (portfolio && typeof portfolio.dailyRealized === 'function') ? -portfolio.dailyRealized() : 0;
  const budget = {
    scope: scope || (tokenMint ? `token:${tokenMint}` : 'global'),
    used_notional_usd: used,
    daily_loss_usd: dailyLoss,
    within_budget: maxToken == null ? false : projected <= maxToken,
  };
  if (maxToken != null) {
    budget.max_notional_usd = maxToken;
    budget.remaining_usd = maxToken - projected;
  }
  return budget;
}
