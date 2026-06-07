# @soltrade/position-lifecycle (Gate B / B3)

PositionLifecycleStateMachine حتمي **in-memory**، مشتقّ من `docs/00-ARCHITECTURE §15.1/§4.1` و`docs/05-DATA-MODEL §4.3 (positions)` و`docs/01-SSOT G1/G2/G4/G9`. **بلا DB writes · بلا execution · بلا signing/sending · بلا شبكة.**

## المحتوى
- `position-lifecycle.mjs` / `.d.ts` — `createPositionLifecycle({ audit? })` → `{ open, transition, advanceMigrationPhase, handoverControlBrain, get, list, isTerminal, auditEntries, size }` + `isTerminalState(s)` + `POSITION_TRANSITIONS` + `POSITION_TERMINAL_STATES`.
- `fixtures/sample-position.json`.

## transitions (مشتقّة من ARCH §15.1)
`OPENING→{OPEN,FAILED_ENTRY}` · `OPEN→{PARTIALLY_EXITING,EXIT_PENDING,MIRROR_SELL_PENDING,MIGRATION_PENDING,CLOSED,CLOSED_WITH_DUST,FAILED_EXIT}` · `PARTIALLY_EXITING→{OPEN,EXIT_PENDING,CLOSED,CLOSED_WITH_DUST,FAILED_EXIT}` · `EXIT_PENDING→{PARTIALLY_EXITING,CLOSED,CLOSED_WITH_DUST,FAILED_EXIT}` · `MIRROR_SELL_PENDING→{PARTIALLY_EXITING,OPEN,CLOSED,CLOSED_WITH_DUST,FAILED_EXIT}` · `MIGRATION_PENDING→{OPEN,EXIT_PENDING,CLOSED,CLOSED_WITH_DUST,FAILED_EXIT}` · `FAILED_EXIT→{EXIT_PENDING,CLOSED,CLOSED_WITH_DUST}` · **terminal (بلا خروج): `CLOSED`·`CLOSED_WITH_DUST`·`FAILED_ENTRY`**.

## conflict rules
- يُسمح فقط بانتقالات `ALLOWED[current]`؛ غيرها → `{ ok:false, api_error_code:'COMMAND_NOT_ALLOWED_IN_STATE', reason:'illegal_transition' }`.
- terminal لا يعود لحالة مفتوحة · `FAILED_EXIT` لا يعود `OPEN` · حالات `*_PENDING` تمنع بدء إجراء متعارض.
- `migration_phase` للأمام فقط (`advanceMigrationPhase`)؛ `market_phase` يعكسه.
- `current_control_brain`: handover `brain_a→brain_b` فقط عند `migration_phase ∈ {LP_MINTED, POST_MIGRATION_ACTIVE}`؛ غيره مرفوض.
- `entry_brain` و`config_version_at_entry` **مجمّدان** (لا setter).

## الأسماء (SSOT/API/DATA فقط)
`position_state`·`migration_phase`·`strategy_brain`(entry/current_control)·`market_phase`·`active_exit_route`·`config_version_at_entry` + `COMMAND_NOT_ALLOWED_IN_STATE` + `resource_type='position'`. `id` = storage-only (DATA §4.3). **لا `api_error_code` جديد** (`reason` داخلي).

## repository / interface
repository **in-memory** (Map، قابل لاستبدال adapter) · `audit` interface حقن اختياري، الافتراضي `@soltrade/data createAuditLog` (in-memory، بلا DB) · **لا delete/reopen/setConfigVersion/setEntryBrain**.

> **لا قدرة تنفيذ/تداول · لا توقيع/إرسال · لا DB writes/migrations · لا RPC/providers.** يدير حالة المركز فقط.
