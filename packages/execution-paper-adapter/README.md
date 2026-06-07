# @soltrade/execution-paper-adapter (Gate B / B4)

محوّل تنفيذ **ورقي (PAPER) / test harness فقط**، مشتقّ من `docs/00-ARCHITECTURE §3` (PAPER-LIVE: *same order object → simulator → simulated fill/fees/failures. No sign, no send.*). **لا تنفيذ حقيقي · لا توقيع · لا إرسال · لا تسلسل · لا on-chain · لا DB · لا شبكة.**

## المحتوى
- `paper-execution-adapter.mjs` / `.d.ts` — `createPaperExecutionAdapter({ ledger, lifecycle, signer })` → `{ simulate(order, ctx) }`.
- `fixtures/paper-order.json` — order + ctx (قيم dev، بلا أسرار).

## execution pipeline (الحُرّاس قبل المحاكي)
1. **IntentLedger** — لا order بلا `intent_id`؛ والنيّة يجب أن تكون مُسجَّلة (إن مُرِّر ledger).
2. **Risk Gates** — `evaluateHardRisk`؛ `decision=block` → يوقف (warning_only لا يتجاوز Hard Risk).
3. **Signer Boundary** — `requestSignature({mode:'paper',...})` لإثبات `signed=false`/`signature=null` (invariant يرفع خطأ لو خولف).
4. **PositionLifecycle** — انتقال in-memory فقط؛ غير قانوني → `blocked_by:position_lifecycle`.
5. **CostPipeline (foundations)** — محاكي fill حتمي؛ غير priceable → simulated failure.

## simulated result model
`{ mode:'paper', simulated, executed:false, is_valid_on_chain:false, signed:false, signature:null, intent_id, risk?, signer?, lifecycle?, simulated_fill?{simulated,is_valid_on_chain:false,total_cost_lamports} | failure?{simulated,failure_type?|reason}, blocked_by?, reason?, note }`.

## failure modes
`intent_id` مفقود/غير مُسجَّل → `blocked_by:intent_ledger` · risk block → `blocked_by:risk_gates` · انتقال غير قانوني → `blocked_by:position_lifecycle` · `inject_failure` (قيمة `failure_type` من G3) → simulated failure · cost غير priceable → simulated failure.

## الأسماء (SSOT/API/DATA فقط)
`failure_type` (G3) + ما تعيده الحُرّاس (`HARD_RISK_BYPASS_REJECTED`/`COMMAND_NOT_ALLOWED_IN_STATE` القائمة). envelope/`mode='paper'` داخلي. **لا `api_error_code` جديد · لا أسماء مرفوضة.**

> **لا real/live execution · لا REAL-LIVE · لا transaction building/serialization/signing/sending · لا RPC/providers · لا DB writes · لا قدرة تداول.** المخرجات كلها موسومة `paper`/`simulated` وليست صالحة on-chain.
