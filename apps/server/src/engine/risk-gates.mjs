// risk-gates.mjs — the hard-risk entry gate, OWNED by @soltrade/risk (ADR-0001 Phase 2C).
// The RISK_BACKEND legacy in-process shim was REMOVED in Phase 3B.2 after Phase 3B.1 proved the legacy
// output was byte-identical to the package on both the allow and reject paths. The server now delegates
// straight to the package; this module re-exports it so existing import paths keep working.
export { checkEntryGates } from '../../../../packages/risk/src/index.mjs';
