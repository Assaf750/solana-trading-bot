// @soltrade/profit-sweep — Profit Sweep orchestration (Gate D / D2). SIMULATED, owner-bound, candidate.
// SOURCE: docs/01-SSOT.md G15 (profit_sweep_policy, profit_sweep_interval_ms, settlement_wallet_id/_address,
//   sweep_profits, execution_wallet_id, position_owner_wallet_id) + G31 (candidate balance/sweep read-model)
//   + G36 (candidate sweep config policy) + G11 (resource_type=profit_sweep, error codes) + G14 (audit)
//   + docs/03-API §12.5 + docs/05-DATA §4.11 (profit_sweep_events).
//
// SIMULATED / in-memory / deterministic. There is NO actual sweep, NO token transfer, NO transaction
// building/serialization, NO signing/sending, NO RPC/provider, NO DB writes, NO KeyManager, NO key
// material, NO rotation, NO new asset_transfer_intents, NO REAL-LIVE, NO execution authority,
// NO UX/API/dashboard exposure, NO Opportunity/Radar P&L. All balance/sweep figures are candidate_*
// read-model inputs (not on-chain truth). candidate_ prefixes are preserved; nothing is promoted.

import { PROFIT_SWEEP_POLICY } from '../../ssot-types/src/core-enums.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const PERM_ERR = 'PERMISSION_DENIED';
for (const e of [PERM_ERR, 'COMMAND_NOT_ALLOWED_IN_STATE']) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
if (!PERMISSION_ROLE.includes('admin')) throw new Error('internal: admin role drift');

const RESOURCE = 'profit_sweep'; // SSOT G11 resource_type
const COMMAND = 'sweep_profits';

// SSOT-listed values for the DEFERRED candidate enums (G31). Used as literals, prefix preserved,
// NOT promoted/registered in ssot-types.
const BALANCE_PROVENANCE = ['on_chain', 'derived'];
const RECONCILIATION_STATUS = ['reconciled', 'pending', 'mismatch'];

// G36 candidate config defaults (F6).
const DEFAULT_CONFIG = Object.freeze({
  candidate_balance_reconciliation_required: true,
  candidate_profit_sweep_confirmation_required: true,
  candidate_auto_sweep_enabled: false,
});

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function createProfitSweep({ walletRegistry, auditLog, config } = {}) {
  const audit = auditLog || createAuditLog();
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const events = [];          // candidate_sweep_event ledger (append-only)
  const confirmed = new Set(); // ids confirmed via simulateConfirm (impl detail, not a stored field)
  let seq = 0;

  function record(req, audit_reason, api_error_code) {
    const entry = { command_type: COMMAND, resource_type: RESOURCE, audit_scope: RESOURCE, audit_actor: req.audit_actor, audit_reason, permission_role: req.permission_role };
    if (api_error_code) entry.api_error_code = api_error_code;
    if (isStr(req.request_id)) entry.request_id = req.request_id;
    audit.append(entry);
  }

  function sweepable(execution_wallet_id) {
    if (!walletRegistry) return true; // standalone mode
    const w = walletRegistry.get(execution_wallet_id);
    return !!w && (w.execution_wallet_status === 'ACTIVE' || w.execution_wallet_status === 'DRAINING');
  }

  function sweepProfits(req = {}) {
    if (!isStr(req.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (req.permission_role !== 'admin') { record(req, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }

    const policy = req.profit_sweep_policy;
    if (!PROFIT_SWEEP_POLICY.includes(policy)) { record(req, 'invalid_profit_sweep_policy'); return { ok: false, reason: 'invalid_profit_sweep_policy' }; }

    // owner-bound: only the owning execution wallet may sweep its profits.
    if (!isStr(req.execution_wallet_id) || req.execution_wallet_id !== req.position_owner_wallet_id) {
      record(req, 'not_owner_bound'); return { ok: false, reason: 'not_owner_bound' };
    }
    if (!sweepable(req.execution_wallet_id)) { record(req, 'execution_wallet_not_sweepable'); return { ok: false, reason: 'execution_wallet_not_sweepable' }; }

    // candidate balance provenance must be valid.
    if (!BALANCE_PROVENANCE.includes(req.candidate_balance_provenance)) { record(req, 'invalid_balance_provenance'); return { ok: false, reason: 'invalid_balance_provenance' }; }

    // reconciliation gate: mismatch / pending / invalid blocks the sweep when required.
    if (cfg.candidate_balance_reconciliation_required) {
      if (req.candidate_balance_reconciliation_status !== 'reconciled') {
        record(req, `reconciliation_not_reconciled:${RECONCILIATION_STATUS.includes(req.candidate_balance_reconciliation_status) ? req.candidate_balance_reconciliation_status : 'invalid'}`);
        return { ok: false, reason: 'reconciliation_not_reconciled' };
      }
    }

    // auto_immediate / periodic: eligibility/orchestration ONLY — no event, no execution.
    if (policy === 'auto_immediate' || policy === 'periodic') {
      const eligible = policy === 'auto_immediate' ? cfg.candidate_auto_sweep_enabled === true : true;
      record(req, `${COMMAND}:${policy}:eligibility_only`);
      return {
        ok: true, simulated: true, executed: false, eligible,
        profit_sweep_policy: policy,
        profit_sweep_interval_ms: isNum(req.profit_sweep_interval_ms) ? req.profit_sweep_interval_ms : null,
      };
    }

    // manual: requires profits available; appends a simulated candidate_sweep_event (not yet confirmed).
    if (!(isNum(req.candidate_profits_available_to_sweep) && req.candidate_profits_available_to_sweep > 0)) {
      record(req, 'no_profits_to_sweep'); return { ok: false, reason: 'no_profits_to_sweep' };
    }
    const id = `swp-${++seq}`;
    const candidate_sweep_event = Object.freeze({
      id, // storage-only PK convention (DATA §6)
      resource_type: RESOURCE,
      profit_sweep_policy: policy,
      execution_wallet_id: req.execution_wallet_id,
      position_owner_wallet_id: req.position_owner_wallet_id,
      settlement_wallet_id: req.settlement_wallet_id ?? null,
      settlement_wallet_address: req.settlement_wallet_address ?? null,
      candidate_profits_available_to_sweep: req.candidate_profits_available_to_sweep,
      candidate_execution_wallet_balance: isNum(req.candidate_execution_wallet_balance) ? req.candidate_execution_wallet_balance : null,
      candidate_settlement_wallet_balance: isNum(req.candidate_settlement_wallet_balance) ? req.candidate_settlement_wallet_balance : null,
      candidate_balance_provenance: req.candidate_balance_provenance,
      candidate_balance_reconciliation_status: req.candidate_balance_reconciliation_status,
    });
    events.push(candidate_sweep_event);
    record(req, `${COMMAND}:manual:recorded:${id}`);
    return {
      ok: true, simulated: true, executed: false,
      requires_confirmation: cfg.candidate_profit_sweep_confirmation_required === true,
      candidate_sweep_event,
    };
    // NOTE: no funds move. The figures are candidate read-model inputs, not on-chain truth.
  }

  /**
   * SIMULATED confirmation (engine hook — NOT an API command). Marks a recorded candidate_sweep_event
   * confirmed; only then does it enter candidate_sweep_history. No funds move.
   */
  function simulateConfirm(sweepEventId) {
    const ev = events.find((e) => e.id === sweepEventId);
    if (!ev) return { ok: false, reason: 'sweep_event_not_found' };
    if (confirmed.has(sweepEventId)) return { ok: false, reason: 'already_confirmed' };
    confirmed.add(sweepEventId);
    return { ok: true, simulated: true, confirmed: true, id: sweepEventId };
  }

  return Object.freeze({
    sweepProfits,
    simulateConfirm,
    auditLog: audit,
    config: Object.freeze({ ...cfg }),
    isConfirmed(sweepEventId) { return confirmed.has(sweepEventId); },
    // candidate_sweep_event ledger (all recorded requests) and candidate_sweep_history (confirmed only).
    candidateSweepEvents() { return events.slice(); },
    candidateSweepHistory() { return events.filter((e) => confirmed.has(e.id)); },
    get size() { return events.length; },
    // No actual sweep. No token transfer. No tx build/sign/send. No rotation. No asset_transfer. No keys. No DB.
  });
}
