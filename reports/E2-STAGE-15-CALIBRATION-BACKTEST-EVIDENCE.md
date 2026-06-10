# E2 Stage-15 — Calibration & Backtest Harness — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/calibration-backtest-foundations`** package — the **Calibration & Backtest Harness**: a pure
> simulated-vs-real **divergence read-model** (ARCH §9 finality discipline) + a **point-in-time /
> survivorship-free backtest dataset descriptor** + a **deterministic replay read-model**, plus the standard
> suppression/forbidden-surface/health spine. All simulated/advisory — **no live data, no signer, no real
> execution, no future leakage; extinct wallets stay in the sample.** Built under the 11 binding Phase-B
> preconditions.
>
> **Build-process note (transparency):** the usual multi-agent build workflow could not run for this stage — the
> session usage limit was hit and ALL build subagents failed before writing anything (verified: clean tree).
> Per the standing mandate the implementation was therefore done in the MAIN loop (this engineer), preserving the
> independence separation the cadence exists for: the **adversarial pre-merge review (separate multi-agent
> workflow) still gates the merge** and runs after the limit resets; the merge happens ONLY on its
> CLEAR_TO_MERGE with zero blockers.
>
> **State:** built on `main` @ `a17dcd0` (branch `pr-s15-calibration-backtest`, `main + 1`, parent == main) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` unchanged · mechanism guard `sources=109 fixtures=27
> allowlist=1 violations=0` · SSOT drift EXACT baseline (included=30/deferred=83 unchanged) · full suite
> **1668/1668** · calibration-backtest-foundations **26/26** + extra boundary probe.

---

## 1. New package
`packages/calibration-backtest-foundations/` (`@soltrade/calibration-backtest-foundations`, v0.0.0, type module,
no dependencies). **Import-free src** — consumes Stage-14 paper P&L results / CalibrationRecord arrays / dataset
records passed in; tests import `paper-execution-foundations` (REAL Stage-14 read-model), the existing
`foundations` CalibrationStore skeleton (finality cross-check), and `send-gate-contract` (still refuses).
14 exports across 7 foundations (A–G).

## 2. The seven foundations
| Part | Foundation | Key behavior |
|---|---|---|
| A | Calibration Input Boundary | eligible ONLY off a real Stage-14 `PAPER_PNL_READ_MODEL` (raw earlier-stage refused: `raw_non_paper_pnl_input_refused`); CalibrationRecord shape validated |
| B | Calibration Divergence Read-Model | pure; **finality = both timestamps** (ARCH §9); per-dimension metric + LOCAL classification `WITHIN_BAND/ELEVATED/HIGH/UNCLASSIFIED`; **bands caller-supplied — never defaulted** (missing → `UNCLASSIFIED`); zero finalized → pessimistic; latency always `UNCLASSIFIED` (`no_paired_latency_metric` — no sim/real pair exists); overall = worst classified |
| C | Backtest Dataset Descriptor | `as_of_rank` non-decreasing (violation → `future_leakage_order_violation`); `future_*`/`lookahead` keys refused; **dropped extinct wallet → `survivorship_risk` INVALID**; declared-inactive path OK; dropped active → DEGRADED |
| D | Backtest Replay Read-Model | dataset **re-validated internally** (only a clean descriptor proceeds); ordered walk; per-wallet FIFO net/gross/fees/slippage + `backtest_wins/losses/flats/open`; `candidate_pnl_by_wallet` (sole registered name used); fill↔record wallet mismatch refused |
| E | Suppression | always-suppressed (three `not_*_authorized` on every path incl. hostile) |
| F | Forbidden Surface Guard | NAME-only redaction (key-material + live names) |
| G | Health | clean path → `CALIB_HEALTH_SUPPRESSED`; explicit not-suppressed → `REVIEWED_ADVISORY` (opens nothing) |

## 3. Hand-computed math (all asserted exactly)
- **Fill divergence:** pairs (100,102),(100,98),(100,100) → metric = (2/102 + 2/98 + 0)/3; bands
  {0.05, 0.15} → `WITHIN_BAND`; {0.013, 0.10} → `ELEVATED`; {0.001, 0.013} → `HIGH` (overall follows worst).
- **Boundary inclusivity probe (extra, run + deleted):** pairs (100,104),(100,96) → metric = (4/104 + 4/96)/2
  exactly; a band with `elevated == metric` classifies `ELEVATED` (≥ is inclusive — pessimistic).
- **exit_success:** sim [T,T,F,T] vs real [T,F,F,F] → |0.75 − 0.25| = 0.5 → `ELEVATED` under {0.2, 0.6}.
- **provider_reliability:** 1 failure / 4 finalized = 0.25 → `WITHIN_BAND` under {0.3, 0.5}.
- **Finality:** a record missing `timestamp_confirmed` is excluded (counts asserted); zero finalized →
  `pessimistic_no_finalized_records`; **cross-checked vs `createCalibrationStore`** (same finalized counts; its
  pessimistic priors at zero finalized).
- **Replay FIFO:** w-1 buys 10@1 + 5@2, sell 12@3 (lot-boundary crossing) → gross 22, fees 0.4, slippage 0.2,
  **net 21.4**, P1 open; w-2 buy 4@5, sell 4@4 → gross −4, **net −4.5**, `backtest_losses:1`. Determinism by
  double-eval deep-equal.

## 4. Security spine
Planted `private_key`/`endpoint`/`signature`/`serialized_tx`/etc. VALUES provably absent from `JSON.stringify`
of every output (guard, divergence, replay, health); one bad record/fill refuses the WHOLE input; execution-shaped
claims (`executed:true` etc.) refused; fill↔record wallet mismatch refused; hostile proxies → frozen
`*_UNCONFIGURED`, never throws; suppression always carries the three `not_*_authorized`; **send-gate still
`ok:false`/`can_send:false`** beside the calibration/backtest read-models; all 24 exec/readiness flags false on
every state; static guards assert import-free src, no exec-true literal, no clock/RNG/network/fs/env, no
module-level mutable state, candidate usage limited to `candidate_pnl_by_wallet`, and the deferred divergence-enum
value strings absent.

## 5. Verification (so far — merge still gated)
| Layer | Result |
|---|---|
| Package tests | 26/26 |
| Full workspace suite | 1668/1668 |
| Extra boundary/edge probe (run + deleted) | PASS |
| SSOT drift | EXACT baseline (included=30/deferred=83 unchanged) |
| Mechanism guard | `sources=109 allowlist=1 violations=0` |
| Adversarial pre-merge review | **PENDING — required before any merge** (runs when the session limit resets) |

## 6. Governance / scope
Only the new package added; `docs/00`–`12`, `tools/`, `packages/ssot-types`, `packages/foundations` untouched.
No new SSOT name; CalibrationRecord input field names are the established ARCH-§9/`foundations` consumed-only
precedent; deferred enums stay deferred; `candidate_*` stays candidate. Phase-B preconditions honored.

---

**Confirmations:** calibration/backtest are SIMULATED/ADVISORY only (`simulated:true`; never real; never
profitability proof; never a gate) · finality = both timestamps; pessimistic at zero finalized · bands never
defaulted · no future leakage (ordering + key refusal) · survivorship-free (extinct wallets stay or are declared)
· pure deterministic read-models · no live path · send-gate refuses · all 24 flags false · fail-closed ·
drift EXACT · ALLOWLIST unchanged · suite 1668/1668 · `docs/00`–`12` untouched · **merge gated on the pending
adversarial pre-merge review.**
