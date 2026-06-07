# @soltrade/paper-portfolio (Gate B / B8) — CANDIDATE-flagged, backend-only

Paper Portfolio + **P&L read-model candidate-flagged**، backend-only، in-memory، **simulated فقط**. مشتقّ من `docs/00-ARCHITECTURE §2.1/§15.2` و`docs/01-SSOT G22/G28`. **كل أسماء `candidate_*` تبقى candidate** (لا حذف بادئة، لا ترقية).

## القواعد الصارمة
- P&L **read-model خلفي، ليس مصدر حقيقة، غير مكشوف لـ UX، ولا على Opportunity/Radar أبداً.**
- `candidate_unrealized_pnl` يُحسَب/يُعرَض **فقط عند `candidate_mark_status='valid'`**؛ mark بائت/غير صالح → `null` (`unrealized_available:false`).
- تُقبل fills **paper/simulated فقط** (`is_valid_on_chain:true` مرفوض)؛ كل المخرجات `simulated:true`؛ **ليست on-chain truth**.
- لا execution/signing/sending · لا RPC/providers · لا DB writes · لا network.

## المحتوى
- `paper-portfolio.mjs` / `.d.ts` — `createPaperPortfolio()` → `{ addSimulatedFill, getRealized, getUnrealized, getPortfolio, positions }`.
- `fixtures/simulated-fills.json`.

## realized P&L
FIFO lot-based على بيوع simulated: `candidate_realized_pnl` (Σ (sell−lot)×matched) · `candidate_fees_total` · `candidate_slippage_cost` (تراكميّة).

## unrealized P&L / mark-status
`getUnrealized(position_ref, { candidate_mark_status, mark })`: status≠`valid` → `candidate_unrealized_pnl:null` + `unrealized_available:false` (+reason). status=`valid` + mark رقم → `(mark − avg_open_cost) × open_quantity`.

## candidate usage summary
`candidate_realized_pnl` · `candidate_unrealized_pnl` · `candidate_fees_total` · `candidate_slippage_cost` · `candidate_mark_status` — **كلها candidate محفوظة البادئة**. `position_ref` مفتاح داخلي (storage-only نظير `id`).

> **candidate لا يتحول إلى implemented · backend-only read-model · P&L ليست مصدر حقيقة · لا UX/API/Opportunity/Radar · لا قدرة تداول.**
