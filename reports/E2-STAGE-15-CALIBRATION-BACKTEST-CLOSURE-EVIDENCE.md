# E2 Stage-15 — Calibration & Backtest Harness — CLOSURE EVIDENCE

> **Stage-15 closure (documentation-only report; no code change in this commit).** Stage 15 delivered the new
> **`@soltrade/calibration-backtest-foundations`** package — the Calibration & Backtest Harness: a pure
> simulated-vs-real **divergence read-model** (ARCH §9 finality), a **point-in-time / survivorship-free backtest
> dataset descriptor**, a **deterministic replay read-model**, plus the standard suppression/forbidden-surface/
> health spine. All simulated/advisory — no live data, no signer, no real execution.
>
> **State on `main`:** `cf87dfc` (Stage-15 fully landed: `188dfab` package + `cf87dfc` TOCTOU fix) · 7 foundations
> (A–G) · **14 exports** · package **28/28** · full suite **1670/1670** · SSOT drift EXACT baseline
> (included=30/deferred=83 unchanged) · mechanism guard `sources=109 fixtures=27 allowlist=1 violations=0` ·
> `docs/00`–`12` / `tools/` / `ssot-types` / `foundations` untouched.

---

## 1. Build-process record (full transparency — the cadence worked exactly as designed)
1. The usual multi-agent build workflow was killed by a **session usage limit** before writing anything
   (verified clean tree). Per the standing mandate, the implementation was done in the **main loop**, with the
   **adversarial pre-merge review kept as the primary independent gate** — the branch was committed but
   **explicitly not merged** until that review returned clean.
2. **The adversarial review (4 lenses + arbiter) returned `DO_NOT_MERGE` with ONE confirmed blocker — a real
   TOCTOU bug in the main-loop implementation:** `evaluateBacktestReplay` validated the dataset internally but
   **re-read `dataset.records` for the walk**; a hostile getter could serve a clean array to validation and a
   dirty array (out-of-order `as_of_rank`, `future_alpha`, `executed:true`) to consumption. The arbiter
   reproduced the bypass exactly. (All other lenses: clear — math/security/governance/behavioral verified green.)
3. **Fix `cf87dfc` — SNAPSHOT pattern:** every field is read exactly once; the SAME snapshot is validated and
   walked. Applied to the replay (dataset records/cohort/declared + each fill) and uniformly to the divergence
   records (screen == compute view). A throwing accessor still lands fail-closed. Two regression tests assert
   read-exactly-once semantics with counting getters.
4. **Re-review (TOCTOU-fix lens + regression lens + arbiter): `CLEAR_TO_MERGE`, 0 blockers.** The arbiter
   independently re-ran the original attack: the hostile records getter is read **exactly once** (`recReads=1`),
   the dirty array is never consumed, validated==walked proven via a no-bait control; residual non-consuming
   double-reads confirmed inert; fill-side and divergence-price getters read exactly once.
   **This is the independence layer doing precisely its job: a defect the implementer missed was caught,
   reproduced, fixed, regression-locked, and independently re-verified before any merge.**

## 2. Delivered foundations
| Part | Foundation | Key behavior |
|---|---|---|
| A | Calibration Input Boundary | eligible ONLY off a real Stage-14 `PAPER_PNL_READ_MODEL`; raw refused |
| B | Divergence Read-Model | finality = both timestamps; per-dimension metrics; LOCAL `WITHIN_BAND/ELEVATED/HIGH/UNCLASSIFIED`; bands caller-supplied (never defaulted); pessimistic at zero finalized; latency always UNCLASSIFIED; **records snapshotted once** |
| C | Backtest Dataset Descriptor | `as_of_rank` non-decreasing; `future_*` keys refused; dropped extinct wallet → `survivorship_risk` INVALID; declared-inactive supported |
| D | Backtest Replay | **snapshot validated == snapshot walked (TOCTOU-proof)**; per-wallet FIFO net/gross/fees/slippage + win/loss/flat/open; `candidate_pnl_by_wallet` (sole registered name); wallet mismatch refused |
| E | Suppression | always-suppressed (three `not_*_authorized` on every path) |
| F | Forbidden Surface Guard | NAME-only redaction |
| G | Health | clean path → SUPPRESSED |

## 3. Verified math (hand-computed, multiple independent parties)
Fill divergence (2/102 + 2/98 + 0)/3 with band classifications WITHIN/ELEVATED/HIGH; boundary-inclusive `>=`;
exit_success |0.75−0.25| = 0.5; provider_reliability 0.25; finality exclusion counts; pessimistic zero-finalized
(cross-checked vs `createCalibrationStore`); replay FIFO nets **21.4 / −4.5** with lot-boundary crossing and
oversell-ignore; determinism by double-eval. The pre-merge lenses and both arbiters re-derived these with their
own novel scenarios — exact agreement everywhere.

## 4. Verification summary
| Layer | Result |
|---|---|
| Package tests (incl. 2 TOCTOU regressions) | 28/28 |
| Full workspace suite | 1670/1670 |
| First adversarial review | DO_NOT_MERGE — 1 real blocker confirmed (TOCTOU) |
| Fix + regression tests | `cf87dfc` |
| Re-review (attack re-run with counting getters) | CLEAR_TO_MERGE, 0 blockers |
| SSOT drift / mechanism guard | EXACT · `sources=109 allowlist=1 violations=0` |
| Merge | `cf87dfc` (`--ff-only`; branch = main+2: package + fix; parent chain == main) |

## 5. Governance / scope / readiness impact
Only the new package + evidence reports added. No new SSOT name; CalibrationRecord field names are the
established ARCH-§9/`foundations` consumed-only precedent; deferred divergence enums stay deferred; `candidate_*`
in code limited to `candidate_pnl_by_wallet`. **Readiness impact: none** — calibration/backtest outputs are
simulated/advisory read-models (`simulated:true`), never profitability proof, never a gate, never execution
authority; send-gate still refuses; all 24 exec/readiness flags false everywhere.

---

**Stage-15 CLOSED.** Calibration & Backtest Harness complete (A–G, 14 exports, 28 tests) · finality
both-timestamps · pessimistic-by-default · bands never defaulted · no future leakage · survivorship-free ·
TOCTOU-proof snapshot discipline (caught by the adversarial gate, fixed, regression-locked, re-verified) ·
simulated-only · all 24 flags false · fail-closed · drift EXACT · ALLOWLIST unchanged · suite 1670/1670 ·
`docs/00`–`12` untouched. **Next = Stage 16 (Strategy & Wallet Profitability Intelligence).**
