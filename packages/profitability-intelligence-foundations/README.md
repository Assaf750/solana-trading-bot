# @soltrade/profitability-intelligence-foundations — Stage-16 (Phase B)

Simulated-only, read-only/advisory **Strategy & Wallet Profitability Intelligence** foundations:

| Part | Foundation | Export pair |
|---|---|---|
| A | Profitability Input Boundary (Stage-14 paper P&L + Stage-15 backtest replay) | `describeProfitabilityInputBoundaryContract` / `evaluateProfitabilityInputBoundary` |
| B | Wallet Profitability Read-Model (pure, over the Stage-15 replay per-wallet map) | `describeWalletProfitabilityContract` / `evaluateWalletProfitability` |
| C | Heuristic Risk Flags (diagnostic only) | `describeProfitabilityRiskFlagsContract` / `evaluateProfitabilityRiskFlags` |
| D | Copyability Advisory Composer (advisory only) | `describeCopyabilityAdvisoryContract` / `evaluateCopyabilityAdvisory` |
| E | Profitability Suppression (always-suppressed) | `describeProfitabilitySuppressionContract` / `evaluateProfitabilitySuppression` |
| F | Profitability Forbidden Surface Guard (NAME-only redaction) | `describeProfitabilityForbiddenSurfaceContract` / `evaluateProfitabilityForbiddenSurface` |
| G | Profitability Health | `describeProfitabilityHealthContract` / `evaluateProfitabilityHealth` |

## Core rules
- **Simulated + advisory only.** Every derived read-model carries `simulated:true` + `advisory_only:true`;
  numbers derive from SIMULATED paper/backtest outputs and are never real profit, never profitability proof,
  never execution authority. All 24 exec/readiness flags stay false on every state.
- **An advisory is NOT a command.** `profitability_advisory` is a LOCAL enum token
  (`PROFITABILITY_ADVISORY_{INSUFFICIENT_EVIDENCE, NOT_COPY_SUITABLE, PREFER_WATCH_ONLY, KEEP_EVALUATING}`),
  explicitly not config, not auto-applied; no output carries an instruction-shaped field; an advisory never
  closes positions, never changes follow state, never bans, never disables anything. `KEEP_EVALUATING` is
  NEVER a copy-allowed-style promotion — promotion is a different governed system.
- **Risk veto:** a suspected risk flag (loss-dominant / one-hit concentration) vetoes regardless of positive
  net — apparent profit is not copyable edge until the risk is cleared.
- **Fail-safe evidence:** `min_sample_size` is caller-supplied, NEVER defaulted — missing/invalid yields the
  `INSUFFICIENT_EVIDENCE` posture for every wallet. Missing heuristic thresholds mean flags CANNOT clear a
  wallet (`profitability_flags_unevaluated:true` — unevaluated, not clean).
- **Honest metrics:** the Stage-15 replay buckets carry win/loss/flat COUNTS, not per-position money sums —
  `profitability_profit_factor` is therefore ALWAYS `null` (never faked); the count ratio is exposed as
  `profitability_win_loss_ratio`.
- **TOCTOU snapshots:** every consumed result/map/bucket/entry is snapshotted EXACTLY ONCE (`{ ...spread }`)
  and the SAME snapshot is validated and consumed (counting-getter regression-tested on (B) and (C)).
- **Fail-Safe-Not-Fail-Open:** hostile/missing/smuggled/forbidden-named/execution-shaped input → frozen
  `*_UNCONFIGURED`/`*_INVALID`/`*_BLOCKED`; values never echoed; never throws.

`src` is import-free, pure, deterministic; no clock/RNG/network/fs/env; no dependency; no module-level mutable
state. The only registered candidate field name used in code is `candidate_pnl_by_wallet` (G22 precedent,
consumed-only from the Stage-15 replay). The deferred SSOT intelligence enums (wallet-type / fake-profit /
adverse-selection / copyability-veto / pump-classification / drift / profit-source) stay deferred — every minted
field/state/flag here is a LOCAL `profitability_`/`PROFITABILITY_` (or spec-fixed `COPYABILITY_ADVISORY_`)
identifier, and no deferred enum value string is used as a token.
