# E2 Stage-14 — Paper Execution Engine (Phase-B opener) — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/paper-execution-foundations`** package — the **simulated-only Paper Execution Engine**: candidate
> paper-fill descriptors + a **pure FIFO P&L read-model** (realized FIFO · mark-gated unrealized ·
> fees/slippage-aware · aggregations per wallet/copy-mode/brain) + outcome classifier + the standard suppression/
> forbidden-surface/health spine. **This is the first stage where profitability is measured — with NO real money, NO
> live data, NO signer, NO real execution.** Every fill/P&L output carries `simulated:true` + `is_valid_on_chain:false`;
> all 24 exec/readiness flags stay false; the send-gate keeps refusing (no paper bypass). Built under the 11 binding
> Phase-B preconditions of the Phase-A Gate (`reports/E2-PHASE-A-GATE-INTEGRATION-REGRESSION-EVIDENCE.md`).
>
> **State:** built on `main` @ `bef969c` (branch `pr-s14-paper-execution`, `main + 1`, parent == main) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` unchanged · mechanism guard `sources=107 fixtures=27
> allowlist=1 violations=0` · SSOT drift EXACT baseline (**included=30 / deferred=83 unchanged**) · full suite
> **1642/1642** · paper-execution-foundations **29/29** · independent main-loop spot-check **29/29**.

---

## 1. New package
`packages/paper-execution-foundations/` (`@soltrade/paper-execution-foundations`, v0.0.0, type module, no
dependencies). **Import-free src** — consumes Stage-13 results / fill arrays passed in; the test imports the real
Stage-4→13 chain (verbatim) plus `paper-portfolio`, `execution-paper-adapter`, and `send-gate-contract` for real
inputs and cross-checks. 14 exports across 7 foundations (A–G).

## 2. The seven foundations
| Part | Foundation | Key behavior |
|---|---|---|
| A | Paper-Execution Input Boundary | eligible ONLY off a real Stage-13 `PIPELINE_DECISION_REVIEWED_ADVISORY`; raw earlier-stage/trace-bundle inputs refused |
| B | Candidate Paper-Fill Descriptor | frozen simulation record: `paper_fill_kind:'candidate_paper_fill'`, `simulated:true`, `is_valid_on_chain:false`, `executed:false`, `signed:false`, `signature:null`; REJECTS `is_valid_on_chain:true`/`executed:true`/`signed:true`/forbidden fields |
| C | Paper P&L Read-Model | **pure FIFO function** over the fills array (no internal state): per-position realized/fees/slippage/open-qty/avg-cost; `candidate_unrealized_pnl` ONLY when `mark_status_bucket==='valid'`; totals gross + **NET** (`candidate_paper_pnl` = gross − fees − slippage); aggregations `candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain`; oversell ignored (no shorts) |
| D | Paper Outcome Classifier | LOCAL states `PAPER_EXEC_OUTCOME_{OPEN,CLOSED_PROFIT,CLOSED_LOSS,CLOSED_FLAT,FAILED,…}` — the deferred SSOT enum `candidate_paper_outcome_state` untouched |
| E | Paper-Execution Suppression | always-suppressed (`not_execution`/`not_sign`/`not_send`_authorized on every path) |
| F | Paper Forbidden Surface Guard | NAME-only redaction (key-material + live names) |
| G | Paper-Execution Health | clean path → SUPPRESSED; REVIEWED_ADVISORY only with explicit not-suppressed, opens nothing |

## 3. candidate_* discipline (drift baseline unchanged)
Outputs reuse **only** the 9 already-registered G22 candidate FIELD names (`candidate_realized_pnl`,
`candidate_unrealized_pnl`, `candidate_fees_total`, `candidate_slippage_cost`, `candidate_paper_pnl`,
`candidate_pnl_by_wallet`, `candidate_pnl_by_copy_mode`, `candidate_pnl_by_brain`, consumed-only
`candidate_mark_status` bucket values) + the prescribed `candidate_paper_fill` kind literal — the paper-portfolio
precedent. `packages/ssot-types` untouched; the deferred enum stays deferred; a static test enforces the allowed set.
SSOT drift **EXACT** (`included=30 / deferred=83` unchanged).

## 4. P&L math verified three independent times
1. **Build tests (29/29):** scripted multi-position scenario with hand-asserted FIFO numbers + cross-check vs
   `createPaperPortfolio` (exact per-position equality on realized/fees/slippage) + purity (deep-equal double
   evaluation).
2. **Build arbiter's own probe:** independent dyadic-value scenario (gross 22/−10, net 9, buckets summing exactly)
   — matched exactly; oversell + stale-mark paths verified.
3. **My independent main-loop spot-check (29/29, temp script then deleted), MY OWN scenario:** P1 buys 10@1.0 + 5@2.0,
   sell 12@3.0 (FIFO crosses the lot boundary) → gross **22**, open **3 @ avg 2.0**, unrealized **1.5** under valid
   mark; P2 buy 4@5.0, sell 4@4.0 → gross **−4** → `PAPER_EXEC_OUTCOME_CLOSED_LOSS`; totals gross **18**, fees
   **0.8**, slippage **0.3**, **NET 16.9**; `candidate_pnl_by_wallet` w-a **21.4** / w-b **−4.5** (sum = NET);
   unrealized **null** under a stale mark; purity confirmed; cross-check vs `createPaperPortfolio` matched.

## 5. Security spine verified
- Fill claiming `is_valid_on_chain:true` → `CANDIDATE_PAPER_FILL_REJECTED`. A fill carrying a `private_key` name →
  the **whole** P&L input refused `PAPER_PNL_INVALID`, planted VALUE absent from `JSON.stringify`.
- Part-F guard: planted `endpoint`/`serialized_tx`/`signature` values → `PAPER_SURFACE_BLOCKED`,
  `forbidden_field_ref` = NAME only, value redacted, all 24 flags false; hostile → UNCONFIGURED, never throws.
- Suppression always carries the three `not_*_authorized` (clean/missing/hostile).
- `evaluateSendPreflight` still `ok:false`/`can_send:false` beside a full paper P&L read-model — **no paper bypass**;
  the Gate-B adapter still blocks orders without `intent_id`. Boundary refuses a raw Stage-12 result.
- `simulated:true` + `is_valid_on_chain:false` on every fill/P&L/outcome output and every nested aggregate.

## 6. Verification summary
| Layer | Result |
|---|---|
| Build workflow (impl + P&L-math/security/governance/behavioral lenses + arbiter w/ own FIFO probe) | GREEN, 0 confirmed blockers |
| Package tests | 29/29 |
| Full workspace suite | 1642/1642 |
| Independent main-loop spot-check (own hand-computed scenario) | 29/29 |
| SSOT drift | EXACT baseline (included=30/deferred=83 unchanged) |
| Mechanism guard | `sources=107 allowlist=1 violations=0` |

## 7. Governance / scope
Only the new package added; `docs/00`–`12`, `tools/`, `packages/ssot-types`, `paper-portfolio`,
`execution-paper-adapter`, `send-gate-contract` all untouched. No new SSOT name; LOCAL states everywhere else;
`candidate_*` stays candidate. Phase-B preconditions 1–11 all honored.

---

**Confirmations:** Paper execution is SIMULATION ONLY (`simulated:true` everywhere; never presented as real) · first
profitability measurement with no real money · pure FIFO P&L read-model (backend read-model, not UX truth, no
Opportunity/Radar P&L) · mark-gated unrealized · per-wallet/mode/brain aggregation · no live path (no signing/
sending/broadcast/network/RPC) · send-gate still refuses (no paper bypass) · all 24 exec/readiness flags false on
every state · fail-closed (never throws) · src import-free · drift EXACT · ALLOWLIST unchanged · full suite
1642/1642 · package 29/29 · independent spot-check 29/29 · `docs/00`–`12` untouched.
