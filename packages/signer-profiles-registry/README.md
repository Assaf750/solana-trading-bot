# @soltrade/signer-profiles-registry (Gate C / C1) — references-only

سجلّ ملفات التوقيع + آلة حالة `signer_profile_status` — **references-only**، حتمي **in-memory**. مشتقّ من `docs/01-SSOT G15` و`docs/05-DATA §4.8` و`docs/03-API §12.2` و`docs/09-THREAT-SECURITY`. **لا private key/seed/keypair/mnemonic · لا KeyManager · لا signing library · لا توقيع/إرسال · لا RPC/providers · لا admission gate · لا DB writes · لا execution authority.**

## المحتوى
- `signer-profiles-registry.mjs` / `.d.ts` — `createSignerProfilesRegistry()` → `{ register, transition, get, list, isTerminal, size }` + `isTerminalSignerStatus()` + `SIGNER_PROFILE_TRANSITIONS`.
- `fixtures/signer-profile.json` (مرجع فقط، بلا أي مادة مفاتيح).

## الحقول (G15/DATA §4.8)
`signer_profile_id` · `signer_profile_status` · `key_custody_mode`. **لا مادة مفاتيح** (تُرفض عند الإدخال).

## state machine (G15)
`DISABLED → {ACTIVE, REVOKED}` · `ACTIVE → {DISABLED, DEGRADED, REVOKED}` · `DEGRADED → {ACTIVE, DISABLED, REVOKED}` · **`REVOKED → {}` (نهائي)**.
- **التسجيل يبدأ `DISABLED`** (لا ACTIVE تلقائي؛ الجاهزية تتطلّب transition صريحاً).
- انتقال غير قانوني → `COMMAND_NOT_ALLOWED_IN_STATE`.

## custody modes (G15)
`connected_wallet` · `isolated_signer` — enum-only (يُرفض ما عداهما).

## permission policy
الأوامر الحسّاسة (`register`/`transition` بما فيها revoke/disable) تتطلّب **`permission_role=signer_control`** (مفصول عن admin)؛ بدونه → `PERMISSION_DENIED`.

## repository
Map in-memory (مراجع فقط) · **لا key load/store · لا sign() · لا admission gate (C2) · لا delete · لا DB**.

> **references-only · لا KeyManager · لا مادة مفاتيح · لا سلطة توقيع/تنفيذ.** يوفّر سجلّ/حالة الـ signer كمراجع آمنة فقط.
