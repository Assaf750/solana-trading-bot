# @soltrade/paper-e2e (Gate B / B9)

تنسيق المسار الورقي end-to-end + دليل إغلاق Gate B. **paper/simulated/in-memory فقط.** يربط الحزم القائمة بلا أسماء جديدة.

## المسار
`replay ingestion → decision (skeleton) → [paper adapter: Risk Gates → Signer boundary (no sign) → Position Lifecycle] عبر Intent Ledger → Paper Portfolio (candidate P&L) → audit in-memory`.

## المحتوى
- `paper-e2e.mjs` / `.d.ts` — `runPaperPipeline(scenario, deps?)` يعيد `{ ok, simulated:true, completed, stopped_at?, signed:false, executed:false, is_valid_on_chain:false, position_state?, stages }` + `evaluateRpcHealth` (دليل `provider_degraded`→EXITS_ONLY policy).
- `fixtures/happy-scenario.json`.

## القواعد
- **paper/simulated فقط** · Risk block يوقف المسار · لا order بلا `intent_id` · signer لا يوقّع · adapter لا يرسل · positions in-memory · P&L candidate/simulated/backend · audit append-only in-memory.
- **لا live trading · لا REAL-LIVE · لا Gate C · لا RPC/providers · لا network · لا signing/sending · لا DB writes · لا UX/API exposure · لا P&L على Opportunity/Radar.**

> أداة تنسيق/إثبات للمسار الورقي؛ لا تمنح أي قدرة تنفيذ/تداول.
