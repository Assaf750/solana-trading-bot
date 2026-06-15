// risk-center.test.mjs — pure risk-posture aggregation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/engine/risk-center.mjs';

const fullHardRisk = Object.fromEntries(['max_daily_loss_pct', 'max_daily_loss_usdt', 'max_total_drawdown_pct', 'max_open_positions', 'max_position_size_pct', 'max_token_exposure_pct', 'max_creator_exposure_pct', 'max_cluster_exposure_pct', 'max_correlated_meme_exposure_pct'].map((f) => [f, 5]));
const cleanConfig = { hard_risk: fullHardRisk, safety: { enabled: true, require_mint_revoked: true, require_freeze_revoked: true, block_permanent_delegate: true }, copy_defaults: { stop_loss_pct: 30, max_entry_slippage_vs_leader: 5, trailing_stop_pct: 20 }, market_filters: { min_fdv_usd: 1000 } };
const okStatus = { kill_switch: { global: { engaged: false } }, vault: { vault_unlocked: true }, readiness: { blockers: [] }, engine: { paper_engine: 'active' } };

test('risk: clean config + good state => posture ok', () => {
  const r = assessRisk({ status: okStatus, config: cleanConfig, portfolioSummary: { entries_blocked: false } });
  // only the info-level "cluster_unenforced" note remains
  assert.equal(r.posture, 'ok');
  assert.ok(!r.findings.some((f) => f.severity === 'block' || f.severity === 'warn'));
});

test('risk: kill switch engaged => block posture', () => {
  const r = assessRisk({ status: { ...okStatus, kill_switch: { global: { engaged: true } } }, config: cleanConfig });
  assert.equal(r.posture, 'blocked');
  assert.ok(r.findings.some((f) => f.code === 'kill_engaged'));
});

test('risk: daily-loss tripped => block', () => {
  const r = assessRisk({ status: okStatus, config: cleanConfig, portfolioSummary: { entries_blocked: true } });
  assert.ok(r.findings.some((f) => f.code === 'daily_loss_tripped' && f.severity === 'block'));
});

test('risk: anti-rug disabled => block + caution toggles', () => {
  const r = assessRisk({ status: okStatus, config: { ...cleanConfig, safety: { enabled: false } } });
  assert.ok(r.findings.some((f) => f.code === 'antirug_disabled' && f.severity === 'block'));
});

test('risk: incomplete hard-risk + no stop-loss => warnings', () => {
  const r = assessRisk({ status: okStatus, config: { hard_risk: {}, safety: cleanConfig.safety, copy_defaults: {} } });
  assert.ok(r.findings.some((f) => f.code === 'hard_risk_incomplete'));
  assert.ok(r.findings.some((f) => f.code === 'no_stop_loss'));
  assert.equal(r.posture, 'caution');
});

test('risk: no RPC + locked vault => block + watch data risks', () => {
  const r = assessRisk({ status: { kill_switch: { global: { engaged: false } }, vault: { vault_unlocked: false }, readiness: { blockers: [{ blocker: 'rpc_provider_not_configured' }] } }, config: cleanConfig });
  assert.ok(r.findings.some((f) => f.code === 'no_rpc' && f.severity === 'block'));
  assert.ok(r.findings.some((f) => f.code === 'vault_locked'));
});

test('risk: findings are severity-sorted (block first) + counts present', () => {
  const r = assessRisk({ status: { ...okStatus, kill_switch: { global: { engaged: true } } }, config: { hard_risk: {}, safety: { enabled: false }, copy_defaults: {} } });
  assert.equal(r.findings[0].severity, 'block');
  assert.ok(r.counts.block >= 1);
});
