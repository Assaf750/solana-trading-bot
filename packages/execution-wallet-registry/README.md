# @soltrade/execution-wallet-registry (Gate C / C0)

سجلّ محافظ التنفيذ + آلة حالة `execution_wallet_status` — حتمي **in-memory**. مشتقّ من `docs/01-SSOT G15` و`docs/05-DATA §4.7` و`docs/03-API §12.1`. **لا DB writes · لا signer profiles · لا admission gate · لا مفاتيح · لا توقيع/إرسال · لا RPC/providers · لا execution authority.**

## المحتوى
- `execution-wallet-registry.mjs` / `.d.ts` — `createExecutionWalletRegistry()` → `{ register, transition, isActionAllowed, get, list, isTerminal, size }` + `isTerminalWalletStatus()` + `EXECUTION_WALLET_TRANSITIONS`/`EXECUTION_WALLET_ACTION_POLICY`.
- `fixtures/execution-wallet.json` (بلا أي مادة مفاتيح).

## الحقول (G15/DATA §4.7)
`execution_wallet_id` · `execution_wallet_address` · `execution_wallet_status` · `execution_wallet_creation_mode` · `funding_wallet_id` · `settlement_wallet_id`. **لا private key/seed/keypair/mnemonic** (يُرفض إدخالها).

## state machine (G15)
`WARMING_UP → {ACTIVE, DISABLED, DRAINING, REVOKED}` · `ACTIVE → {DRAINING, DISABLED, REVOKED}` · `DISABLED → {WARMING_UP, ACTIVE, DRAINING, REVOKED}` · `DRAINING → {RETIRED, REVOKED}` · `RETIRED → {REVOKED}` · **`REVOKED → {}` (نهائي)**.
- **التسجيل يبدأ `WARMING_UP` دائماً** (لا ACTIVE عند التسجيل).
- **`ACTIVE` عبر transition صريح فقط**؛ الانتقال الفعلي بفحوص القبول = admission gate في **C2** (ليس هنا).
- انتقال غير قانوني → `{ ok:false, api_error_code:'COMMAND_NOT_ALLOWED_IN_STATE' }`.

## action policy
| status | new_entry | new_admission | exit |
|---|---|---|---|
| ACTIVE | ✓ | ✓ | ✓ |
| **DRAINING** | **✗** | **✗** | ✓ |
| WARMING_UP/DISABLED/RETIRED/REVOKED | ✗ | ✗ | ✗ |
`DRAINING` يمنع الدخول/القبول الجديد ويسمح بالخروج. أي action مجهول → مرفوض (fail-safe).

## repository
Map in-memory · `register` تسجيل منطقي (لا DB) · **لا delete · لا activate-with-checks (C2) · لا signer linkage (C1)**.

> **لا key material · لا signer · لا admission · لا قدرة تنفيذ.** يوفّر primitive السجلّ والحالة فقط.
