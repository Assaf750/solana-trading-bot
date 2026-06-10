# @soltrade/calibration-backtest-foundations — Stage-15 (Phase B)

Simulated-only, read-only/advisory **Calibration & Backtest Harness** foundations:

| Part | Foundation | Export pair |
|---|---|---|
| A | Calibration Input Boundary | `describeCalibrationInputBoundaryContract` / `evaluateCalibrationInputBoundary` |
| B | Calibration Divergence Read-Model (pure, simulated-vs-real) | `describeCalibrationDivergenceContract` / `evaluateCalibrationDivergence` |
| C | Backtest Dataset Descriptor (point-in-time / survivorship-free) | `describeBacktestDatasetDescriptorContract` / `evaluateBacktestDatasetDescriptor` |
| D | Backtest Replay Read-Model (pure deterministic walk) | `describeBacktestReplayContract` / `evaluateBacktestReplay` |
| E | Calibration Suppression (always-suppressed) | `describeCalibrationSuppressionContract` / `evaluateCalibrationSuppression` |
| F | Calibration Forbidden Surface Guard (NAME-only redaction) | `describeCalibrationForbiddenSurfaceContract` / `evaluateCalibrationForbiddenSurface` |
| G | Calibration Health | `describeCalibrationHealthContract` / `evaluateCalibrationHealth` |

## Core rules
- **Simulated only.** Divergence/replay read-models carry `simulated:true`; never presented as real; never
  profitability proof; never execution authority. All 24 exec/readiness flags stay false on every state.
- **Finality (ARCH §9):** only records with BOTH `timestamp_processed` and `timestamp_confirmed` enter divergence;
  zero finalized → pessimistic `UNCLASSIFIED` (never silently `WITHIN_BAND`). Matches the
  `packages/foundations` CalibrationStore skeleton (cross-checked in tests).
- **Fail-safe bands:** divergence bands MUST be caller-supplied; missing band → `UNCLASSIFIED`
  (`missing_divergence_band`). Defaults are never invented (band thresholds are a CONFIG follow-up).
- **No future leakage:** backtest records are consumed strictly in non-decreasing `as_of_rank` order; any
  `future_*`/`lookahead` key refused.
- **Survivorship-free:** extinct cohort wallets must remain in the sample (or be declared inactive);
  a silently-dropped extinct wallet is refused as `survivorship_risk`.
- **Fail-Safe-Not-Fail-Open:** hostile/missing/smuggled/forbidden-named input → frozen
  `*_UNCONFIGURED`/`*_INVALID`; values never echoed; never throws.

`src` is import-free, pure, deterministic; no clock/RNG/network/fs/env; no dependency; no module-level mutable
state. The only registered candidate field name used in code is `candidate_pnl_by_wallet` (G22 precedent). The
deferred SSOT divergence enums stay deferred — classification tokens are LOCAL SCREAMING-CASE strings.
