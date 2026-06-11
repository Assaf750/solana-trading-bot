// api.mjs — HTTP contract. Pure handler ({method,path,body}) -> {status,body} for testability.
// Trading/config commands go through POST /api/commands with SSOT command_type names.
// Vault/session endpoints are local ops surfaces (auth-like), not trading commands.
// RULE: no response ever contains a raw secret — refs + masked previews only.
import { computeReadiness } from './readiness.mjs';

export function createApi({ config, wallets, killSwitch, operatingState, vault, signer, audit, broadcast, paperEngine, portfolio }) {
  const emit = typeof broadcast === 'function' ? broadcast : () => {};

  function readiness() {
    return computeReadiness({ config, vault, killSwitch, signerStatus: signer.status() });
  }

  function statusPayload() {
    const cfg = config.get();
    return {
      operating_state: operatingState.get(),
      mode: cfg.mode,
      config_version: cfg.config_version,
      readiness: readiness(),
      vault: vault.status(),
      signer: signer.publicState(),
      kill_switch: killSwitch.status(),
      engine: {
        ...(paperEngine ? paperEngine.status() : { paper_engine: 'not_started' }),
        live_engine: 'not_built', // honest until M4
      },
    };
  }

  const commands = {
    update_config({ patch }) {
      const res = config.update(patch);
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'config_updated', command_type: 'update_config', detail: { patch } });
        emit({ event_type: 'config_update', config_version: res.config_version });
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    preview_config_update({ patch }) {
      // preview = validate without saving
      return importValidate(patch);
    },
    register_wallet(p) {
      const res = wallets.register(p || {});
      if (res.ok) {
        audit({ audit_scope: 'wallet', audit_reason: 'wallet_registered', command_type: 'register_wallet', detail: { address: p.tracked_wallet_address } });
        emit({ event_type: 'config_update', wallets_changed: true });
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    update_wallet_config(p) {
      const res = wallets.updateConfig(p?.wallet_id, p?.patch);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'wallet_config_updated', command_type: 'update_wallet_config', detail: p });
      return { status: res.ok ? 200 : res.api_error_code === 'RESOURCE_NOT_FOUND' ? 404 : 400, body: res };
    },
    enable_wallet_follow(p) {
      const res = wallets.setFollow(p?.wallet_id, true);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'follow_enabled', command_type: 'enable_wallet_follow', detail: p });
      return { status: res.ok ? 200 : 404, body: res };
    },
    disable_wallet_follow(p) {
      const res = wallets.setFollow(p?.wallet_id, false);
      if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'follow_disabled', command_type: 'disable_wallet_follow', detail: p });
      return { status: res.ok ? 200 : 404, body: res };
    },
    pause_system() {
      const res = operatingState.transition('PAUSED', 'pause_system command');
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'system_paused', command_type: 'pause_system', detail: {} });
        emit({ event_type: 'health_update', operating_state: res.state });
      }
      return { status: res.ok ? 200 : 409, body: res };
    },
    resume_system() {
      // resume goes through WARMING_UP (caches/health not guaranteed after pause/kill)
      const cur = operatingState.get().operating_state;
      if (cur === 'KILLED') {
        const kill = killSwitch.isBlocked({});
        if (kill.blocked) {
          return {
            status: 409,
            body: { ok: false, api_error_code: 'COMMAND_NOT_ALLOWED_IN_STATE', error: 'disengage_kill_switch_first' },
          };
        }
      }
      const res = operatingState.transition('WARMING_UP', 'resume_system command');
      if (res.ok) {
        audit({ audit_scope: 'config', audit_reason: 'system_resumed_via_warming_up', command_type: 'resume_system', detail: {} });
        emit({ event_type: 'health_update', operating_state: res.state });
      }
      return { status: res.ok ? 200 : 409, body: res };
    },
    trigger_kill_switch(p) {
      const res = killSwitch.engage({ level: p?.level || 'global', key: p?.key || null, reason: p?.reason || 'manual' });
      if (res.ok) {
        signer.lockSession('kill_switch'); // global kill locks the signer immediately
        if ((p?.level || 'global') === 'global') operatingState.transition('KILLED', `kill switch: ${p?.reason || 'manual'}`);
        audit({ audit_scope: 'config', audit_reason: `kill_engaged_${p?.level || 'global'}`, command_type: 'trigger_kill_switch', detail: p || {} });
        emit({ event_type: 'health_update', kill_switch: res.state, operating_state: operatingState.get() });
      }
      return { status: res.ok ? 200 : 400, body: res };
    },
    activate_real_live(p) {
      const r = readiness();
      const blockers = [...r.blockers];
      // Honest M1/M3 blocker: the live execution engine ships in M4.
      blockers.push({ blocker: 'live_engine_not_built_yet' });
      if (p?.confirm !== 'ACTIVATE-REAL-LIVE') {
        blockers.push({ blocker: 'explicit_confirmation_required', expected: 'confirm: ACTIVATE-REAL-LIVE' });
      }
      if (blockers.length > 0) {
        audit({ audit_scope: 'config', audit_reason: 'real_live_activation_refused', command_type: 'activate_real_live', detail: { blockers } });
        return { status: 409, body: { ok: false, api_error_code: 'REAL_LIVE_CONFIG_INVALID', blockers, readiness: r } };
      }
      // unreachable in M1 by construction (live_engine blocker above) — M4 replaces this path
      return { status: 409, body: { ok: false, api_error_code: 'REAL_LIVE_CONFIG_INVALID', blockers } };
    },
  };

  function importValidate(patch) {
    // local import to avoid circulars at module load
    return import('./config-service.mjs').then(({ validateConfigPatch }) => {
      const res = validateConfigPatch(patch);
      return { status: res.validation_status === 'valid' ? 200 : 400, body: { ok: res.validation_status === 'valid', ...res } };
    });
  }

  async function handle({ method, path, body }) {
    try {
      // ---------- GET resources ----------
      if (method === 'GET') {
        if (path === '/api/status') return { status: 200, body: statusPayload() };
        if (path === '/api/config') return { status: 200, body: config.get() };
        if (path === '/api/readiness') return { status: 200, body: readiness() };
        if (path === '/api/wallets') return { status: 200, body: { wallets: wallets.list() } };
        if (path === '/api/secrets') return { status: 200, body: { secrets: vault.listRefs() } };
        if (path.startsWith('/api/audit')) {
          const limit = Math.min(500, Number(new URLSearchParams(path.split('?')[1] || '').get('limit')) || 100);
          const { readAuditTail } = await import('./audit-log.mjs');
          return { status: 200, body: { audit: readAuditTail(limit) } };
        }
        if (path === '/api/positions') {
          const s = portfolio ? portfolio.state() : { positions: [] };
          return { status: 200, body: { simulated: true, positions: s.positions, summary: portfolio ? portfolio.summary() : null } };
        }
        if (path === '/api/trades') {
          const s = portfolio ? portfolio.state() : { trades: [] };
          return { status: 200, body: { simulated: true, trades: (s.trades || []).slice(-200) } };
        }
        if (path === '/api/engine-events') {
          return { status: 200, body: { simulated: true, events: paperEngine ? paperEngine.events(80) : [] } };
        }
        if (path === '/api/intents') return { status: 200, body: { intents: [], note: 'intent ledger surfaces with the live engine (M4)' } };
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      // ---------- POST ops ----------
      if (method === 'POST') {
        if (path === '/api/commands') {
          const ct = body?.command_type;
          if (!ct || typeof commands[ct] !== 'function') {
            return { status: 400, body: { ok: false, api_error_code: 'COMMAND_NOT_ALLOWED_IN_STATE', error: 'unknown_or_unsupported_command_type' } };
          }
          const out = await commands[ct](body || {});
          return out;
        }
        // vault/session ops (local auth surface; bodies never logged)
        if (path === '/api/vault/create') {
          const res = vault.create(body?.passphrase);
          if (res.ok) audit({ audit_scope: 'config', audit_reason: 'vault_created', command_type: null, detail: {} });
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/vault/unlock') {
          const res = vault.unlock(body?.passphrase);
          audit({ audit_scope: 'config', audit_reason: res.ok ? 'vault_unlocked' : 'vault_unlock_failed', command_type: null, detail: {} });
          return { status: res.ok ? 200 : 401, body: res };
        }
        if (path === '/api/vault/lock') {
          signer.lockSession('vault_locked');
          const res = vault.lock();
          audit({ audit_scope: 'config', audit_reason: 'vault_locked', command_type: null, detail: {} });
          return { status: 200, body: res };
        }
        if (path === '/api/secrets') {
          const res = vault.setSecret(body?.name, body?.value);
          if (res.ok) {
            audit({ audit_scope: 'config', audit_reason: 'secret_stored', command_type: 'candidate_cmd_register_provider', detail: { ref: res.ref } });
            emit({ event_type: 'config_update', secrets_changed: true });
          }
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/signer/import-key') {
          const res = signer.importKey(body?.secret);
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/signer/open-session') {
          const res = signer.openSession();
          return { status: res.ok ? 200 : 409, body: res };
        }
        if (path === '/api/signer/lock') {
          return { status: 200, body: signer.lockSession('manual') };
        }
        if (path === '/api/kill-switch/disengage') {
          // explicit human action; global disengage requires typed confirmation
          if ((body?.level || 'global') === 'global' && body?.confirm !== 'DISENGAGE') {
            return { status: 400, body: { ok: false, error: 'explicit_confirmation_required', expected: 'confirm: DISENGAGE' } };
          }
          const res = killSwitch.disengage({ level: body?.level || 'global', key: body?.key || null });
          if (res.ok) {
            audit({ audit_scope: 'config', audit_reason: `kill_disengaged_${body?.level || 'global'}`, command_type: null, detail: { level: body?.level, key: body?.key } });
            emit({ event_type: 'health_update', kill_switch: res.state });
          }
          return { status: res.ok ? 200 : 400, body: res };
        }
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      if (method === 'DELETE') {
        if (path.startsWith('/api/secrets/')) {
          const name = decodeURIComponent(path.slice('/api/secrets/'.length));
          const res = vault.deleteSecret(name);
          if (res.ok) audit({ audit_scope: 'config', audit_reason: 'secret_deleted', command_type: null, detail: { name } });
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path === '/api/signer/key') {
          const res = signer.deleteKey();
          return { status: res.ok ? 200 : 400, body: res };
        }
        if (path.startsWith('/api/wallets/')) {
          const id = decodeURIComponent(path.slice('/api/wallets/'.length));
          const res = wallets.remove(id);
          if (res.ok) audit({ audit_scope: 'wallet', audit_reason: 'wallet_removed', command_type: null, detail: { wallet_id: id } });
          return { status: res.ok ? 200 : 404, body: res };
        }
        return { status: 404, body: { ok: false, api_error_code: 'RESOURCE_NOT_FOUND' } };
      }

      return { status: 405, body: { ok: false, error_message: 'method_not_allowed' } };
    } catch (err) {
      // fail-closed: structured error, never a crash, never a secret in the message
      return { status: 500, body: { ok: false, error_message: 'internal_error', detail: String(err?.message || '').slice(0, 200) } };
    }
  }

  return { handle, statusPayload };
}
