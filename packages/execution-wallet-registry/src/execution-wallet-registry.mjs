// @soltrade/execution-wallet-registry — Execution Wallets registry + state machine (Gate C / C0).
// SOURCE: docs/01-SSOT.md G15 + docs/05-DATA-MODEL.md §4.7 (execution_wallets) + docs/03-API §12.1.
// Deterministic, in-memory only. NO DB writes, NO signer profiles, NO admission gate, NO keys,
// NO signing/sending, NO RPC/provider, NO execution authority.
//
// INVARIANTS:
//  - register() starts at WARMING_UP (never ACTIVE on registration).
//  - ACTIVE is reached only via an explicit transition (the real admission gate is C2, not here).
//  - REVOKED is terminal (no outgoing). DRAINING blocks new entry/admission.
//  - NO private key / seed / keypair / mnemonic fields anywhere.

import { EXECUTION_WALLET_STATUS, EXECUTION_WALLET_CREATION_MODE } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';

const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE'; // SSOT G11 (must exist)
if (!API_ERROR_CODE.includes(STATE_ERR)) throw new Error('internal: COMMAND_NOT_ALLOWED_IN_STATE missing');

// Explicit transition graph over execution_wallet_status (SSOT G15). REVOKED is terminal.
const ALLOWED = Object.freeze({
  WARMING_UP: ['ACTIVE', 'DISABLED', 'DRAINING', 'REVOKED'],
  ACTIVE: ['DRAINING', 'DISABLED', 'REVOKED'],
  DISABLED: ['WARMING_UP', 'ACTIVE', 'DRAINING', 'REVOKED'],
  DRAINING: ['RETIRED', 'REVOKED'],
  RETIRED: ['REVOKED'],
  REVOKED: [],
});

// Per-state action policy. Only ACTIVE permits a new entry/admission. Unknown action => false.
const ACTION_POLICY = Object.freeze({
  WARMING_UP: { new_entry: false, new_admission: false, exit: false },
  ACTIVE: { new_entry: true, new_admission: true, exit: true },
  DISABLED: { new_entry: false, new_admission: false, exit: false },
  DRAINING: { new_entry: false, new_admission: false, exit: true }, // drains: exits allowed, no new entries
  RETIRED: { new_entry: false, new_admission: false, exit: false },
  REVOKED: { new_entry: false, new_admission: false, exit: false },
});

const isStr = (v) => typeof v === 'string' && v.length > 0;
// Fields that must NEVER appear on an execution wallet record (key material).
const FORBIDDEN_FIELDS = ['private_key', 'privateKey', 'secret_key', 'secretKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair'];

export function isTerminalWalletStatus(status) {
  return status === 'REVOKED';
}

export function createExecutionWalletRegistry() {
  const byId = new Map(); // execution_wallet_id -> frozen record
  const set = (rec) => { byId.set(rec.execution_wallet_id, Object.freeze(rec)); };

  return Object.freeze({
    /** Register a new execution wallet. Always starts WARMING_UP. No key material accepted. */
    register(input = {}) {
      // Stage-20 hardening (reports/E2-STAGE-20): hostile/uninspectable input -> refuse, never throw.
      // The null/array/non-object guard handles those; the try/catch additionally catches a throwing-getter
      // (uninspectable) object so a thrown property access becomes a structured refusal, never an exception.
      if (input == null || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'invalid_request' };
      try {
        if (!isStr(input.execution_wallet_id)) return { ok: false, reason: 'execution_wallet_id_required' };
        if (byId.has(input.execution_wallet_id)) return { ok: false, reason: 'execution_wallet_exists' };
        for (const f of FORBIDDEN_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(input, f)) return { ok: false, reason: 'key_material_not_accepted' };
        }
        const creation = input.execution_wallet_creation_mode ?? 'manual';
        if (!EXECUTION_WALLET_CREATION_MODE.includes(creation)) return { ok: false, reason: 'invalid_execution_wallet_creation_mode' };
        set({
          execution_wallet_id: input.execution_wallet_id,
          execution_wallet_address: input.execution_wallet_address ?? null,
          execution_wallet_status: 'WARMING_UP', // never ACTIVE on registration
          execution_wallet_creation_mode: creation,
          funding_wallet_id: input.funding_wallet_id ?? null,
          settlement_wallet_id: input.settlement_wallet_id ?? null,
        });
        return { ok: true, execution_wallet_id: input.execution_wallet_id, execution_wallet_status: 'WARMING_UP' };
      } catch {
        return { ok: false, reason: 'invalid_request' };
      }
    },

    /** Explicit state transition. Illegal transitions are rejected (COMMAND_NOT_ALLOWED_IN_STATE). */
    transition(execution_wallet_id, toStatus) {
      const cur = byId.get(execution_wallet_id);
      if (!cur) return { ok: false, reason: 'execution_wallet_not_found' };
      if (!EXECUTION_WALLET_STATUS.includes(toStatus)) return { ok: false, reason: 'invalid_execution_wallet_status' };
      const allowed = ALLOWED[cur.execution_wallet_status] || [];
      if (!allowed.includes(toStatus)) {
        return { ok: false, api_error_code: STATE_ERR, reason: 'illegal_transition', from: cur.execution_wallet_status, to: toStatus };
      }
      set({ ...cur, execution_wallet_status: toStatus });
      return { ok: true, execution_wallet_status: toStatus };
    },

    isActionAllowed(execution_wallet_id, action) {
      const cur = byId.get(execution_wallet_id);
      if (!cur) return false;
      const policy = ACTION_POLICY[cur.execution_wallet_status] || {};
      return policy[action] === true;
    },

    get(execution_wallet_id) { return byId.get(execution_wallet_id); },
    list() { return [...byId.values()]; },
    isTerminal(execution_wallet_id) { const r = byId.get(execution_wallet_id); return !!r && isTerminalWalletStatus(r.execution_wallet_status); },
    get size() { return byId.size; },
    // NO activate-with-checks (admission gate = C2). NO signer linkage (C1). NO delete. NO keys.
  });
}

export const EXECUTION_WALLET_TRANSITIONS = ALLOWED;
export const EXECUTION_WALLET_ACTION_POLICY = ACTION_POLICY;
