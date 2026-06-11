// @soltrade/execution-wallet-pool — Execution Wallet Pool view + Assignment Policy (Gate D / D0).
// SOURCE: docs/01-SSOT.md G15 (wallet_assignment_policy, execution_wallet_status, execution_wallet_id/_address,
//   current/entry_execution_wallet_id, tracked_wallet_address) + G2 (strategy_brain) + G6 (Hard Risk limits)
//   + docs/05-DATA §5.4 (execution_wallet_runtime_eligibility, read-only projection) + docs/03-API §12.2
//   (set_execution_wallet_assignment_policy — referenced by name only).
//
// SELECTION ONLY. Deterministic, in-memory, read-view over the C0 registry. It chooses WHICH eligible
// execution wallet would take a new entry — it does NOT open, fund, transfer, sign, send, or own anything.
//
// FORBIDDEN HERE (and absent): asset transfer / token transfer, transfer-boundary, rotation, sweep,
// transaction building/serialization, signing/sending, KeyManager, key material, RPC/provider, DB writes,
// REAL-LIVE, Gate E, execution authority, candidate_* promotion.
//
// Hard Risk is GLOBAL and aggregate (mock input only): adding wallets creates NO new budget, so a pool of
// many wallets cannot bypass Hard Risk. Missing risk input under risk_weighted => fail-safe reject.

import { WALLET_ASSIGNMENT_POLICY, STRATEGY_BRAIN } from '../../ssot-types/src/core-enums.mjs';
import { HARD_RISK_FIELDS } from '../../config/src/schema.mjs';

const SET_POLICY_COMMAND = 'set_execution_wallet_assignment_policy'; // SSOT G11 (name reference only)

// Eligibility for a NEW ENTRY = the C0 registry permits the 'new_entry' action, which by C0's
// ACTION_POLICY is true ONLY for execution_wallet_status === 'ACTIVE'. So DRAINING/DISABLED/
// RETIRED/REVOKED/WARMING_UP are never selectable. (execution_wallet_runtime_eligibility concept.)
function isEligibleForEntry(walletRegistry, id) {
  return walletRegistry.isActionAllowed(id, 'new_entry') === true;
}

// Deterministic stable index (no clock, no randomness) for per_strategy / per_source_wallet.
function stableIndex(key, n) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % n;
}

const reject = (reason) => ({ ok: false, assigned: false, reason });

export function createExecutionWalletPool({ walletRegistry } = {}) {
  if (!walletRegistry || typeof walletRegistry.isActionAllowed !== 'function') {
    throw new Error('execution-wallet-pool requires the C0 walletRegistry');
  }

  let policy = null;                 // current wallet_assignment_policy (set explicitly)
  let rrCursor = 0;                  // round_robin cursor (deterministic)
  const assignCount = new Map();     // execution_wallet_id -> times selected (for least_active/round_robin)

  const countOf = (id) => assignCount.get(id) || 0;

  // Eligible wallet ids, sorted by execution_wallet_id for deterministic ordering.
  function eligibleIds() {
    return walletRegistry.list()
      .map((w) => w.execution_wallet_id)
      .filter((id) => isEligibleForEntry(walletRegistry, id))
      .sort();
  }

  function pickLeastLoaded(ids) {
    let best = ids[0];
    for (const id of ids) if (countOf(id) < countOf(best)) best = id; // ids pre-sorted => stable tie-break
    return best;
  }

  function hardRiskHasCapacity(input) {
    // Mock/aggregate Hard Risk input ONLY (same shape as @soltrade/risk-gates): { risk_config, measured }.
    // Required & complete, else fail-safe reject. Aggregate measured >= any limit => exhausted (no bypass).
    const risk = input && typeof input.risk_config === 'object' ? input.risk_config : null;
    const measured = input && typeof input.measured === 'object' ? input.measured : null;
    if (!risk || !measured) return { ok: false, reason: 'risk_input_required' };
    for (const name of HARD_RISK_FIELDS) {
      const limit = risk[name];
      const value = measured[name];
      if (typeof limit !== 'number' || typeof value !== 'number') return { ok: false, reason: 'risk_input_required' };
      if (value >= limit) return { ok: false, reason: 'hard_risk_exhausted' };
    }
    return { ok: true };
  }

  function selectByPolicy(p, ids, req) {
    switch (p) {
      case 'round_robin': {
        const id = ids[rrCursor % ids.length];
        rrCursor = (rrCursor + 1) % ids.length;
        return { id };
      }
      case 'least_active':
        return { id: pickLeastLoaded(ids) };
      case 'per_strategy': {
        const s = req.strategy_brain;
        if (!STRATEGY_BRAIN.includes(s)) return { reason: 'strategy_brain_required' };
        return { id: ids[stableIndex(s, ids.length)] };
      }
      case 'per_source_wallet': {
        const src = req.tracked_wallet_address;
        if (typeof src !== 'string' || src.length === 0) return { reason: 'tracked_wallet_address_required' };
        return { id: ids[stableIndex(src, ids.length)] };
      }
      case 'manual_assignment': {
        const target = req.execution_wallet_id;
        if (typeof target !== 'string' || target.length === 0) return { reason: 'manual_target_required' };
        if (!ids.includes(target)) return { reason: 'manual_target_not_eligible' };
        return { id: target };
      }
      case 'risk_weighted': {
        const cap = hardRiskHasCapacity(req.hard_risk);
        if (!cap.ok) return { reason: cap.reason };
        return { id: pickLeastLoaded(ids) };
      }
      default:
        return { reason: 'invalid_wallet_assignment_policy' };
    }
  }

  return Object.freeze({
    SET_POLICY_COMMAND,

    /** Set the active wallet_assignment_policy (validated against the SSOT enum). */
    setAssignmentPolicy(value) {
      if (!WALLET_ASSIGNMENT_POLICY.includes(value)) return reject('invalid_wallet_assignment_policy');
      policy = value;
      return { ok: true, wallet_assignment_policy: value };
    },

    getAssignmentPolicy() { return policy; },

    /** Read-only eligibility projection (execution_wallet_runtime_eligibility concept). */
    listEligible() {
      return eligibleIds().map((id) => {
        const w = walletRegistry.get(id);
        return { execution_wallet_id: w.execution_wallet_id, execution_wallet_address: w.execution_wallet_address ?? null, execution_wallet_status: w.execution_wallet_status };
      });
    },

    isEligible(id) { return isEligibleForEntry(walletRegistry, id); },

    /**
     * Select WHICH eligible execution wallet would take a new entry under the active (or given) policy.
     * Returns { ok, assigned, execution_wallet_id?, wallet_assignment_policy?, reason? }. SELECTION ONLY.
     */
    assign(req = {}) {
      // Stage-20 hardening (reports/E2-STAGE-20): hostile/uninspectable input -> refuse, never throw.
      if (req == null || typeof req !== 'object' || Array.isArray(req)) return reject('invalid_request');
      try {
        const p = req.wallet_assignment_policy || policy;
        if (!WALLET_ASSIGNMENT_POLICY.includes(p)) return reject('invalid_wallet_assignment_policy');
        const ids = eligibleIds();
        if (ids.length === 0) return reject('no_eligible_execution_wallet');
        const r = selectByPolicy(p, ids, req);
        if (!r.id) return reject(r.reason || 'no_eligible_execution_wallet');
        // Defense-in-depth: never return a non-eligible wallet.
        if (!ids.includes(r.id)) return reject('no_eligible_execution_wallet');
        assignCount.set(r.id, countOf(r.id) + 1);
        return { ok: true, assigned: true, execution_wallet_id: r.id, wallet_assignment_policy: p };
        // NOTE: selection only. No open/own/fund/transfer/sign/send happens here.
      } catch {
        return reject('invalid_request');
      }
    },

    // No transfer. No rotation. No sweep. No signing/sending. No KeyManager. No keys. No DB. No RPC.
  });
}

export const WALLET_ASSIGNMENT_POLICIES = WALLET_ASSIGNMENT_POLICY;
