// @soltrade/execution-wallet-lifecycle — Execution Wallet lifecycle security commands (Gate C / C3).
// SOURCE: docs/01-SSOT.md G11 (command_type, permission_role, api_error_code, resource_type)
//   + G14 (audit_actor/audit_scope/audit_reason) + G15 (execution_wallet_status) + docs/03-API §12.1.
// Commands: drain_execution_wallet | disable_execution_wallet | revoke_execution_wallet.
// Deterministic, in-memory. STATE TRANSITIONS ONLY — no asset transfer of any kind.
//
// FORBIDDEN HERE (and absent): asset_transfer / wallet_rotation / profit_sweep, token transfer,
// transaction building/serialization, signing/sending, KeyManager, key material, RPC/provider,
// DB writes, REAL-LIVE activation, execution authority, candidate_* promotion.
//
// Drain does NOT transfer assets: it is purely a status flip to DRAINING via the C0 registry.
// Revoke is terminal (the C0 graph has no edge out of REVOKED). Audit is append-only in-memory.

import { createAuditLog } from '../../data/src/audit.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { EXECUTION_WALLET_STATUS } from '../../ssot-types/src/core-enums.mjs';

const PERM_ERR = 'PERMISSION_DENIED';
const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE';
for (const e of [PERM_ERR, STATE_ERR]) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
const SIGNER_CONTROL = 'signer_control';
if (!PERMISSION_ROLE.includes(SIGNER_CONTROL) || !PERMISSION_ROLE.includes('admin')) throw new Error('internal: permission_role drift');

const RESOURCE = 'execution_wallet'; // SSOT G11 resource_type
const isStr = (v) => typeof v === 'string' && v.length > 0;

// Command catalog — each is a state transition only, gated by a permission predicate.
// requireSignerControl: revoke is signer_control-only (SSOT G11). drain/disable accept admin or signer_control.
const COMMANDS = Object.freeze({
  drain_execution_wallet: { toStatus: 'DRAINING', requireSignerControl: false },
  disable_execution_wallet: { toStatus: 'DISABLED', requireSignerControl: false },
  revoke_execution_wallet: { toStatus: 'REVOKED', requireSignerControl: true },
});
for (const { toStatus } of Object.values(COMMANDS)) {
  if (!EXECUTION_WALLET_STATUS.includes(toStatus)) throw new Error(`internal: ${toStatus} not in execution_wallet_status`);
}

function permitted(role, requireSignerControl) {
  if (requireSignerControl) return role === SIGNER_CONTROL;       // revoke: signer_control only
  return role === SIGNER_CONTROL || role === 'admin';            // drain/disable: admin or signer_control
}

export function createExecutionWalletLifecycle({ walletRegistry, auditLog } = {}) {
  if (!walletRegistry || typeof walletRegistry.transition !== 'function') {
    throw new Error('execution-wallet-lifecycle requires the C0 walletRegistry');
  }
  const audit = auditLog || createAuditLog(); // in-memory, append-only by construction

  function record(command_type, req, audit_reason, api_error_code) {
    const entry = {
      command_type,
      resource_type: RESOURCE,
      audit_scope: RESOURCE,
      audit_actor: req.audit_actor,
      audit_reason,
      permission_role: req.permission_role,
    };
    if (api_error_code) entry.api_error_code = api_error_code;
    if (isStr(req.request_id)) entry.request_id = req.request_id;
    if (isStr(req.idempotency_key)) entry.idempotency_key = req.idempotency_key;
    if (isStr(req.event_timestamp)) entry.event_timestamp = req.event_timestamp;
    audit.append(entry);
  }

  function run(command_type, req = {}) {
    const spec = COMMANDS[command_type];
    // Stage-20 hardening (reports/E2-STAGE-20): hostile/uninspectable input -> refuse, never throw.
    if (req == null || typeof req !== 'object' || Array.isArray(req)) return { ok: false, reason: 'invalid_request' };
    try {
      // 0) Actor is required to attribute the audit entry (no anonymous lifecycle command).
      if (!isStr(req.audit_actor)) return { ok: false, reason: 'audit_actor_required' };

      // 1) Permission (security command).
      if (!permitted(req.permission_role, spec.requireSignerControl)) {
        const reason = spec.requireSignerControl ? 'signer_control_required' : 'insufficient_permission';
        record(command_type, req, `denied: ${reason}`, PERM_ERR);
        return { ok: false, api_error_code: PERM_ERR, reason };
      }

      // 2) Wallet must exist.
      const wallet = walletRegistry.get(req.execution_wallet_id);
      if (!wallet) {
        record(command_type, req, 'execution_wallet_not_found');
        return { ok: false, reason: 'execution_wallet_not_found' };
      }

      // 3) State transition only — the C0 graph is the single source of transition truth.
      const t = walletRegistry.transition(req.execution_wallet_id, spec.toStatus);
      if (!t.ok) {
        record(command_type, req, `illegal_transition:${wallet.execution_wallet_status}->${spec.toStatus}`, t.api_error_code);
        return { ok: false, api_error_code: t.api_error_code, reason: t.reason, from: t.from, to: t.to };
      }

      // 4) Mandatory audit of the successful transition (append-only).
      record(command_type, req, `${command_type}:${wallet.execution_wallet_status}->${spec.toStatus}`);
      return { ok: true, execution_wallet_status: spec.toStatus, command: command_type };
      // NOTE: no assets moved. drain == status flip only. revoke is terminal (C0 has no edge out of REVOKED).
    } catch {
      return { ok: false, reason: 'invalid_request' };
    }
  }

  return Object.freeze({
    commands: Object.freeze(Object.keys(COMMANDS)),
    auditLog: audit,
    drainExecutionWallet: (req) => run('drain_execution_wallet', req),
    disableExecutionWallet: (req) => run('disable_execution_wallet', req),
    revokeExecutionWallet: (req) => run('revoke_execution_wallet', req),
    // No asset transfer. No rotation. No sweep. No signing/sending. No KeyManager. No keys. No DB.
  });
}

export const LIFECYCLE_COMMANDS = Object.freeze(Object.keys(COMMANDS));
