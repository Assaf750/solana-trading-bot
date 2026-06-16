// @soltrade/trading-engine — the runtime trading orchestrator (ADR-0001; physical extraction begun in
// Phase Engine-2). PURE domain kernel: it imports NO mechanisms (no fs / network / SDK / clock). The
// mechanism-bound implementation substrate (leader-stream ingestion, swap detection, fills, the simulated
// book, the live-executor delegation) is INJECTED via `substrateFactory`. apps/server owns that substrate
// (engine/paper-engine.mjs); this package owns the orchestration LOGIC + the composition entry.

/** Engine lifecycle states (the values surfaced as the `paper_engine` status field). */
export const ENGINE_STATES = Object.freeze({
  STOPPED: 'stopped',
  STOPPED_KILLED: 'stopped_killed',
  WAITING_VAULT_UNLOCK: 'waiting_vault_unlock',
  WAITING_RPC_CONFIG: 'waiting_rpc_config',
  NO_FOLLOWED_WALLETS: 'no_followed_wallets',
  PAUSED_BY_OPERATOR: 'paused_by_operator',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  EXITS_ONLY_STREAM_GAP: 'exits_only_stream_gap',
});

/**
 * Pure lifecycle state machine: given the gathered runtime inputs, return the engine's DESIRED state.
 * Ordering is significant (kill > vault > rpc > wallets > operator-pause > active) and matches the
 * supervisor's prior in-line logic exactly — extracted byte-for-byte in Phase Engine-2 (no behavior
 * change). The caller (apps/server paper-engine) gathers the inputs from its injected deps.
 *
 * @param {object} i
 * @param {boolean} i.killBlocked      kill-switch engaged
 * @param {boolean} i.vaultUnlocked    secrets vault is unlocked
 * @param {boolean} i.rpcConfigured    an RPC URL is configured
 * @param {number}  i.followedCount    number of followed leader wallets
 * @param {string}  i.operatingState   operating-state machine value (e.g. ACTIVE / PAUSED / KILLED)
 * @returns {string} one of ENGINE_STATES
 */
export function deriveDesiredState({ killBlocked, vaultUnlocked, rpcConfigured, followedCount, operatingState } = {}) {
  if (killBlocked) return ENGINE_STATES.STOPPED_KILLED;
  if (!vaultUnlocked) return ENGINE_STATES.WAITING_VAULT_UNLOCK;
  if (!rpcConfigured) return ENGINE_STATES.WAITING_RPC_CONFIG;
  if (!(Number(followedCount) > 0)) return ENGINE_STATES.NO_FOLLOWED_WALLETS;
  if (operatingState === 'PAUSED' || operatingState === 'KILLED') return ENGINE_STATES.PAUSED_BY_OPERATOR;
  return ENGINE_STATES.ACTIVE;
}

/**
 * Compose the runtime trading engine from an injected substrate factory. The package owns the
 * composition entry; the substrate (mechanism-bound) is injected so this package stays pure. Today the
 * substrate IS the full engine, so this returns it unchanged (zero behavior change) — a later phase moves
 * more orchestration here and the substrate shrinks to a simulation-only book.
 *
 * @param {object} o
 * @param {(deps:any)=>any} o.substrateFactory  builds the mechanism-bound engine (apps/server paper-engine)
 * @param {any}             o.deps              the engine dependencies, passed straight through
 */
export function composeTradingEngine({ substrateFactory, deps } = {}) {
  if (typeof substrateFactory !== 'function') throw new Error('trading_engine_requires_substrate');
  return substrateFactory(deps);
}
