// risk-gates.mjs — PURE entry gate: every paper/live entry passes here first.
// Hard-Risk limits are binding; missing limits => fail-safe REJECT (no implicit infinity).
export function checkEntryGates({ cfg, portfolio, sizeUsd, tokenMint, killBlocked, operatingState, entriesBlocked = false, leaderAddress = null }) {
  const rejections = [];

  if (killBlocked) rejections.push('kill_switch_engaged');
  if (operatingState !== 'ACTIVE') rejections.push(`operating_state_${operatingState}_blocks_entry`);
  // once the daily-loss limit trips this book, entries stay blocked for the rest of the day
  if (entriesBlocked) rejections.push('entries_blocked_daily_loss');

  const hr = cfg.hard_risk || {};
  const need = (f) => typeof hr[f] === 'number' && Number.isFinite(hr[f]);

  // Fail-safe: any missing limit blocks entries entirely
  const missing = ['max_daily_loss_pct', 'max_daily_loss_usdt', 'max_total_drawdown_pct', 'max_open_positions',
    'max_position_size_pct', 'max_token_exposure_pct', 'max_creator_exposure_pct', 'max_cluster_exposure_pct',
    'max_correlated_meme_exposure_pct'].filter((f) => !need(f));
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

function round2(n) { return Math.round(n * 100) / 100; }
