# @soltrade/paper-execution-foundations

**Stage-14 (Phase B opener) — PAPER EXECUTION ENGINE foundation. SIMULATED-ONLY, read-only/advisory, fail-closed.**

This package opens Phase B of the build: the first place profitability is *measured* — with **no real money, no live data, no signer, no real execution**. It consumes the already-computed Stage-13 pipeline-decision terminal results and caller-supplied **simulated** fill records (passed in as args) and produces:

| | Foundation | Evaluator | Terminal states |
|---|---|---|---|
| A | Paper-execution input boundary | `evaluatePaperExecutionInputBoundary` | `PAPER_EXEC_INPUT_UNCONFIGURED / _INVALID / _DEGRADED / _VALID` |
| B | Candidate paper-fill descriptor | `evaluateCandidatePaperFill` | `CANDIDATE_PAPER_FILL_UNCONFIGURED / _INVALID / _REJECTED / _DESCRIPTOR` |
| C | Paper P&L read-model (pure FIFO) | `evaluatePaperPnlReadModel` | `PAPER_PNL_UNCONFIGURED / _INVALID / _READ_MODEL` |
| D | Paper outcome classifier (LOCAL states) | `evaluatePaperOutcome` | `PAPER_EXEC_OUTCOME_UNCONFIGURED / _INVALID / _OPEN / _CLOSED_PROFIT / _CLOSED_LOSS / _CLOSED_FLAT / _FAILED` |
| E | Paper-execution suppression (always suppressed) | `evaluatePaperExecutionSuppression` | always `suppressed:true` |
| F | Paper forbidden-surface guard (NAME-only redaction) | `evaluatePaperForbiddenSurface` | `PAPER_SURFACE_UNCONFIGURED / _CLEAN / _BLOCKED` |
| G | Paper-execution health | `evaluatePaperExecutionHealth` | `PAPER_EXEC_HEALTH_UNCONFIGURED / _DEGRADED / _REVIEWED_ADVISORY / _SUPPRESSED / _BLOCKED` |

Each foundation also exposes a `describe*Contract()` descriptor.

## Hard rules (binding Phase-B preconditions)

- **Every fill/result carries `simulated:true`** (fill/P&L outputs also `is_valid_on_chain:false`); nothing is ever presented or stored as real — no Paper/Real mixing.
- **No live execution path**: no signing/sending/broadcast/network/RPC anywhere in `src`; the send-gate contract keeps refusing with **no paper bypass**.
- **All 24 exec/readiness flags are explicitly `false` on every result of every state** (including paper FILLED/PASS states). A paper fill is a simulation record, never a permission.
- **`Object.freeze` + `read_only:true`** on every result; fail-closed boundaries (only the Stage-13 `PIPELINE_DECISION_REVIEWED_ADVISORY` verdict makes the input boundary VALID; raw earlier-stage results / raw trace bundles are refused).
- **NAME-only redaction**: the forbidden-surface guard reports the matched field NAME only; a planted VALUE is provably absent from `JSON.stringify` of every output.
- **Pure & deterministic**: `src` is import-free; no clock, RNG, fs, env, network, or module-level mutable state. The FIFO P&L is a **pure function over an array of fills** — everything is re-derived per call.
- **candidate_* discipline**: only the already-registered candidate FIELD names from the paper-portfolio precedent are reused (`candidate_realized_pnl`, `candidate_unrealized_pnl`, `candidate_fees_total`, `candidate_slippage_cost`, `candidate_paper_pnl`, `candidate_pnl_by_wallet`, `candidate_pnl_by_copy_mode`, `candidate_pnl_by_brain`, `candidate_mark_status` — bucket VALUES consumed-only). The deferred SSOT paper-outcome enum is **not** used; the outcome classifier uses LOCAL states. No new SSOT name is introduced.
- **Paper P&L is a backend read-model only** (always simulated), never UX truth. `candidate_unrealized_pnl` is a number ONLY when that position's mark bucket is exactly `valid`.

## Run

```
node --test packages/paper-execution-foundations/test/*.test.mjs
```
