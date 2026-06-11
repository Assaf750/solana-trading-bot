// @soltrade/execution-wallet-admission — Admission Gate (Gate C / C2). MOCK / in-memory.
// SOURCE: docs/03-API §12.1 (activate_execution_wallet) + docs/01-SSOT G10/G11/G15 + docs/02-CONFIG §6.
// The `activate_execution_wallet` admission gate: WARMING_UP -> ACTIVE only after ALL checks pass.
// Deterministic. NO signing, NO sending, NO KeyManager, NO key material, NO RPC/provider, NO DB, NO REAL-LIVE.
//
// FAIL-SAFE-NOT-FAIL-OPEN: any missing/false/unverifiable check => REJECT (never ACTIVE).
// ADMISSION IS NOT SIGNING and NOT SENDING — it only flips an in-memory wallet state after gating.

import { validateConfig } from '../../config/src/validate.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';

const PERM_ERR = 'PERMISSION_DENIED';
const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE';
const LIVE_ERR = 'REAL_LIVE_CONFIG_INVALID';
for (const e of [PERM_ERR, STATE_ERR, LIVE_ERR]) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
if (!PERMISSION_ROLE.includes('admin') || !PERMISSION_ROLE.includes('signer_control')) throw new Error('internal: permission_role drift');

const COMMAND = 'activate_execution_wallet'; // SSOT G11 command name (gate identity; not invoked as a call)

function reject(reason, api_error_code) {
  return { ok: false, admitted: false, reason, ...(api_error_code ? { api_error_code } : {}) };
}

export function createAdmissionGate({ walletRegistry, signerRegistry } = {}) {
  if (!walletRegistry || !signerRegistry) throw new Error('admission gate requires walletRegistry (C0) + signerRegistry (C1)');

  return Object.freeze({
    command: COMMAND,

    /**
     * activate_execution_wallet admission gate. Returns { ok, admitted, ... }.
     * @param req { execution_wallet_id, signer_profile_id, risk_config, permission_role,
     *             funded, signer_reachable, key_custody_verified, links_signer_or_custody? }
     */
    activateExecutionWallet(req = {}) {
      // Stage-20 hardening (reports/E2-STAGE-20): hostile/uninspectable input -> refuse, never throw.
      if (req == null || typeof req !== 'object' || Array.isArray(req)) return reject('invalid_request');
      try {
        // 1) Permission: admin required; signer_control also required if linking signer / changing custody.
        const role = req.permission_role;
        const needsSignerControl = req.links_signer_or_custody === true;
        const permitted = role === 'admin' || role === 'signer_control';
        if (!permitted) return reject('admin_required', PERM_ERR);
        if (needsSignerControl && role !== 'signer_control') return reject('signer_control_required', PERM_ERR);

        // 2) Wallet must be registered and WARMING_UP.
        const wallet = walletRegistry.get(req.execution_wallet_id);
        if (!wallet) return reject('execution_wallet_not_found');
        if (wallet.execution_wallet_status !== 'WARMING_UP') {
          return reject('wallet_not_warming_up', STATE_ERR);
        }

        // 3) Signer profile must be registered and ACTIVE.
        const signer = signerRegistry.get(req.signer_profile_id);
        if (!signer) return reject('signer_profile_not_found');
        if (signer.signer_profile_status !== 'ACTIVE') return reject('signer_profile_not_active', STATE_ERR);

        // 4) Mock readiness predicates — any false/missing => reject (fail-safe).
        if (signer.key_custody_mode == null) return reject('key_custody_mode_missing');
        if (req.key_custody_verified !== true) return reject('key_custody_not_verified', STATE_ERR);
        if (req.funded !== true) return reject('wallet_not_funded', STATE_ERR);
        if (req.signer_reachable !== true) return reject('signer_not_reachable', STATE_ERR);

        // 5) Hard Risk completeness — real_live_config_valid must be true (no implicit infinity).
        const validation = validateConfig({ risk_config: req.risk_config });
        if (validation.real_live_config_valid !== true) {
          return reject('hard_risk_incomplete', LIVE_ERR);
        }

        // All checks passed -> admit (WARMING_UP -> ACTIVE) via the C0 registry.
        const t = walletRegistry.transition(req.execution_wallet_id, 'ACTIVE');
        if (!t.ok) return reject(t.reason || 'transition_failed', t.api_error_code);
        return { ok: true, admitted: true, command: COMMAND, execution_wallet_status: 'ACTIVE' };
        // NOTE: admission != signing and != sending. No tx is built/signed/sent here.
      } catch {
        return reject('invalid_request');
      }
    },
  });
}

export const ADMISSION_COMMAND = COMMAND;
