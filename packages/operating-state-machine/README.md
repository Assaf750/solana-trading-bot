# @soltrade/operating-state-machine (Gate B / B10)

OperatingStateMachine حتمي **in-memory** — يترجم إشارات الصحّة إلى `operating_state` (G1) ويحكم السماح بالأفعال. مشتقّ من `docs/00-ARCHITECTURE §10` و`docs/01-SSOT G1/G5`. **لا live provider/RPC · لا network · لا DB · لا signing/sending · لا execution authority.** يغلق blocker الـ EXITS_ONLY في بوّابة B→C.

## المحتوى
- `operating-state-machine.mjs` / `.d.ts` — `createOperatingStateMachine({ initial?, slot_lag_threshold? })` → `{ getState, apply, operatorReset, isActionAllowed }` + `evaluateTarget(signals, opts)` (نقيّة) + `OPERATING_ACTION_POLICY`.

## states (G1)
`WARMING_UP` · `ACTIVE` · `EXITS_ONLY` · `PAUSED` · `KILLED`.

## signals (G5)
`provider_degraded` · `slot_lag` (+عتبة) · `stream_gap` (إشارة مشتقّة داخلية) · `protocol_constant_status` (`green`|`changed`).

## transitions (fail-safe)
- `protocol_constant_status='changed'` → **`KILLED`** (sticky؛ استئناف بشري عبر `operatorReset()`).
- `provider_degraded` / `stream_gap` / `slot_lag>threshold` / صحّة غير مؤكَّدة → **`EXITS_ONLY`** (+ `WARNING_CRITICAL`).
- كل-أخضر-مؤكَّد فقط → `ACTIVE`. **لا fail-open**: أي صحّة غير مؤكَّدة → `EXITS_ONLY`.

## action policy
| state | entry | exit | emergency_exit | diagnostic |
|---|---|---|---|---|
| WARMING_UP | ✗ | ✗ | ✗ | ✓ |
| ACTIVE | ✓ | ✓ | ✓ | ✓ |
| **EXITS_ONLY** | **✗** | **✓** | ✓ | ✓ |
| PAUSED | ✗ | ✓ | ✓ | ✓ |
| **KILLED** | **✗** | **✗** | ✗ | ✓ |

> **ملاحظة ARCH §10:** KILLED يسمح بـ Emergency Exit في **مسار التنفيذ الحي** (إن كان أأمن)؛ سياسة Gate-B الورقية هنا متحفّظة (diagnostics فقط تحت KILLED) وتُوفَّق عند بناء مسار الخروج/KILLED الحي (Gate C+). أي action مجهول → مرفوض (fail-safe).

## الأسماء (SSOT فقط)
`operating_state`(+القيم) · `provider_degraded` · `slot_lag` · `protocol_constant_status` · `WARNING_CRITICAL`. `stream_gap`/`reason`/فئات action داخلية. **لا اسم/`api_error_code` جديد.**

> **لا قدرة تنفيذ/تداول · لا live · لا DB.** يقرّر الحالة ويحكم السماح فقط؛ التنفيذ الفعلي (لاحقاً) يستشير هذا الحارس قبل أي دخول.
