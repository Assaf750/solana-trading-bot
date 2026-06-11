// readiness.mjs — derived readiness: real_live_config_valid + the full blocker list.
// Honest by construction: lists every missing owner input; never fabricates readiness.
import { hardRiskComplete } from './config-service.mjs';

export function computeReadiness({ config, vault, killSwitch, signerStatus }) {
  const cfg = config.get();
  const blockers = [];

  const hr = hardRiskComplete(cfg);
  if (!hr.complete) {
    blockers.push({ blocker: 'hard_risk_incomplete', missing_limits: hr.missing_limits });
  }

  const cap = cfg.execution?.capital_limit;
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) {
    blockers.push({ blocker: 'capital_limit_missing_or_invalid' });
  }

  if (!cfg.providers?.rpc_url_ref || !vault.hasSecret(refName(cfg.providers.rpc_url_ref))) {
    blockers.push({ blocker: 'rpc_provider_not_configured' });
  }
  if (!cfg.providers?.jupiter_key_ref || !vault.hasSecret(refName(cfg.providers.jupiter_key_ref))) {
    blockers.push({ blocker: 'jupiter_key_not_configured' });
  }

  const ss = cfg.signer_session || {};
  const sessionFields = ['idle_timeout_ms', 'max_session_ms', 'max_session_notional_usd', 'lock_after_n_risk_rejections'];
  const missingSession = sessionFields.filter((f) => typeof ss[f] !== 'number' || !Number.isFinite(ss[f]));
  if (missingSession.length) {
    blockers.push({ blocker: 'signer_session_bounds_not_configured', missing: missingSession });
  }

  if (signerStatus !== 'ready') {
    blockers.push({ blocker: 'signer_not_ready', signer_status: signerStatus });
  }

  const kill = killSwitch.isBlocked({ mode: 'real_live' });
  if (kill.blocked) {
    blockers.push({ blocker: 'kill_switch_engaged', level: kill.level });
  }

  return {
    real_live_config_valid: hr.complete
      && typeof cap === 'number' && Number.isFinite(cap) && cap > 0,
    real_live_ready: blockers.length === 0,
    blockers,
    validation_status: blockers.length === 0 ? 'valid' : 'warning',
    mode: cfg.mode,
  };
}

function refName(ref) {
  return typeof ref === 'string' && ref.startsWith('vault:') ? ref.slice(6) : '__none__';
}
