// wallet-registry.mjs — tracked (followed) wallets CRUD. SSOT: register_wallet,
// update_wallet_config, enable_wallet_follow, disable_wallet_follow.
import { readJson, writeJson, newId, nowIso } from './util.mjs';

const FILE = 'tracked-wallets.json';
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const PER_WALLET_FIELDS = [
  'copy_mode', 'take_profit_pct', 'stop_loss_pct', 'max_entry_slippage_vs_leader',
  'min_mirror_sell_pct', 'sizing_mode', 'sizing_value', 'rebuy_cooldown',
  'max_time_in_position', 'max_entry_drift_pct', 'drift_action', 'exit_on_leader_sell',
  'auto_pause_after_losses', 'trailing_stop_pct', 'label',
];

export function createWalletRegistry() {
  function load() {
    return readJson(FILE, { wallets: [] }).value;
  }
  function save(state) {
    writeJson(FILE, state);
  }

  function list() {
    return load().wallets;
  }

  function register({ tracked_wallet_address, label, copy_mode }) {
    if (typeof tracked_wallet_address !== 'string' || !BASE58_RE.test(tracked_wallet_address)) {
      return { ok: false, api_error_code: 'CONFIG_VALIDATION_FAILED', error: 'invalid_solana_address' };
    }
    if (copy_mode !== undefined && !['follow_entry_user_exit', 'full_mirror'].includes(copy_mode)) {
      return { ok: false, api_error_code: 'CONFIG_VALIDATION_FAILED', error: 'invalid_copy_mode' };
    }
    const state = load();
    const existing = state.wallets.find((w) => w.tracked_wallet_address === tracked_wallet_address);
    if (existing) {
      // return the existing wallet so callers (e.g. the radar Follow button) can act on it
      // (enable follow) instead of dead-ending on a bare conflict with no id.
      return { ok: false, api_error_code: 'IDEMPOTENCY_CONFLICT', error: 'wallet_already_registered', wallet: existing };
    }
    const wallet = {
      wallet_id: newId('w'),
      tracked_wallet_address,
      label: typeof label === 'string' ? label.slice(0, 64) : '',
      follow_enabled: false, // safe default: registered ≠ followed
      copy_mode: copy_mode || 'follow_entry_user_exit',
      config: {},
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.wallets.push(wallet);
    save(state);
    return { ok: true, wallet };
  }

  function updateConfig(wallet_id, patch) {
    const state = load();
    const w = state.wallets.find((x) => x.wallet_id === wallet_id);
    if (!w) return { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' };
    const errors = [];
    for (const [k, v] of Object.entries(patch || {})) {
      if (!PER_WALLET_FIELDS.includes(k)) { errors.push({ field: k, error: 'unknown_field' }); continue; }
      if (k === 'copy_mode' && !['follow_entry_user_exit', 'full_mirror'].includes(v)) errors.push({ field: k, error: 'invalid_enum' });
      if (k === 'sizing_mode' && !['fixed_usd', 'fixed_sol', 'pct_of_capital'].includes(v)) errors.push({ field: k, error: 'invalid_enum' });
      if (k === 'drift_action' && !['skip', 'shrink'].includes(v)) errors.push({ field: k, error: 'invalid_enum' });
      if (k === 'exit_on_leader_sell' && typeof v !== 'boolean') errors.push({ field: k, error: 'must_be_boolean' });
      if (['take_profit_pct', 'stop_loss_pct', 'max_entry_slippage_vs_leader', 'min_mirror_sell_pct', 'sizing_value', 'max_entry_drift_pct', 'auto_pause_after_losses', 'trailing_stop_pct'].includes(k)
        && v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) {
        errors.push({ field: k, error: 'must_be_positive_finite' });
      }
    }
    if (errors.length) return { ok: false, api_error_code: 'CONFIG_VALIDATION_FAILED', errors };
    if (patch.copy_mode) w.copy_mode = patch.copy_mode;
    if (patch.label !== undefined) w.label = String(patch.label).slice(0, 64);
    w.config = { ...w.config, ...patch };
    delete w.config.copy_mode; delete w.config.label;
    w.updated_at = nowIso();
    save(state);
    return { ok: true, wallet: w };
  }

  function setFollow(wallet_id, enabled) {
    const state = load();
    const w = state.wallets.find((x) => x.wallet_id === wallet_id);
    if (!w) return { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' };
    w.follow_enabled = Boolean(enabled);
    w.updated_at = nowIso();
    save(state);
    return { ok: true, wallet: w };
  }

  function remove(wallet_id) {
    const state = load();
    const idx = state.wallets.findIndex((x) => x.wallet_id === wallet_id);
    if (idx === -1) return { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' };
    state.wallets.splice(idx, 1);
    save(state);
    return { ok: true };
  }

  return { list, register, updateConfig, setFollow, remove };
}
