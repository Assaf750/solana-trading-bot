// run-modes.mjs — PURE derivation of the operator-facing run mode from real system state, plus
// a catalog of every mode (what it can do, what it still needs). No persistence, no I/O — a lens
// over the existing status payload (mode / vault / signer / operating_state / kill_switch /
// readiness). Honest: "needs" is computed from real blockers; testnet is reported as not-wired.

/** Current active run mode: read_only | paper | live_armed | live_active. */
export function deriveRunMode(status) {
  const v = status?.vault || {};
  const signer = status?.signer || {};
  const op = status?.operating_state?.operating_state;
  const killEngaged = status?.kill_switch?.global?.engaged !== false;
  if (killEngaged || op === 'KILLED') return 'read_only'; // halted -> view/analyze only
  if (status?.mode === 'real_live') {
    return (v.vault_unlocked && signer.session_active && op === 'ACTIVE') ? 'live_active' : 'live_armed';
  }
  return v.vault_unlocked ? 'paper' : 'read_only';
}

/** Full catalog: each mode's purpose, capabilities, current availability/active flag, and the
 *  concrete requirements still missing to reach/activate it. */
export function runModesCatalog(status) {
  const active = deriveRunMode(status);
  const v = status?.vault || {};
  const signer = status?.signer || {};
  const mode = status?.mode;
  const op = status?.operating_state?.operating_state;
  const killOff = status?.kill_switch?.global?.engaged === false;
  const blockers = (status?.readiness?.blockers || []).map((b) => b.blocker);
  const has = (b) => !blockers.includes(b);
  const need = (cond, label) => (cond ? null : label);

  const modes = [
    {
      id: 'read_only', title: 'Read-only', purpose: 'View & analyze only — never trades.',
      can: ['Analyze wallets', 'Analyze tokens', 'Radar discovery', 'View config & history'],
      needs: [], available: true, active: active === 'read_only',
    },
    {
      id: 'paper', title: 'Paper', purpose: 'Simulated trading at real market prices — no real money.',
      can: ['Auto copy entries/exits (paper)', 'Manual paper buy/sell', 'Limit / DCA (paper)'],
      needs: [need(v.vault_unlocked, 'Unlock the vault'), need(has('rpc_provider_not_configured'), 'Configure an RPC key')].filter(Boolean),
      available: mode === 'paper', active: active === 'paper',
    },
    {
      id: 'testnet', title: 'Testnet', purpose: 'Isolated devnet/testnet sends (no mainnet funds).',
      can: ['Testnet broadcast'], needs: ['Not wired in this build — testnet send boundary is a foundations package only'],
      available: false, active: false, note: 'unavailable',
    },
    {
      id: 'live_armed', title: 'Live · armed', purpose: 'Real-money configured but not actively signing.',
      can: ['Becomes Live · active once the vault is unlocked and a signing session is open'],
      needs: [need(has('hard_risk_incomplete'), 'Complete the 9 hard-risk limits'), need(has('capital_limit_missing_or_invalid'), 'Set a capital limit'), need(signer.key_imported, 'Import a signer key')].filter(Boolean),
      available: mode === 'real_live', active: active === 'live_armed',
    },
    {
      id: 'live_active', title: 'Live · active', purpose: 'Actively trading REAL money on-chain.',
      can: ['Real copy entries/exits', 'Manual live buy/sell', 'Limit / DCA (live)'],
      needs: [need(v.vault_unlocked, 'Unlock the vault'), need(signer.session_active, 'Open a signing session'), need(op === 'ACTIVE', 'System must be ACTIVE'), need(killOff, 'Disengage the kill switch')].filter(Boolean),
      available: mode === 'real_live', active: active === 'live_active',
    },
  ];
  return { active, mode, modes };
}
