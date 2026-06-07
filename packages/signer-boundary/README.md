# @soltrade/signer-boundary (Gate B / B0)

**SignerService boundary — mock/معزول فقط.** seam العزل، مشتقّ من `docs/00-ARCHITECTURE §4.3` و`docs/01-SSOT G15` و`docs/09-THREAT-SECURITY`. **لا يوقّع · لا يرسل · لا يبني transaction · بلا مادة مفاتيح · بلا شبكة · بلا قراءة ملفات/.env.**

## المحتوى
- `signer-boundary.mjs` / `.d.ts` — `createSignerBoundary()` → `{ requestSignature(intent), capabilities() }`.
- `fixtures/paper-signing-intent.json` — مثال نيّة paper **بلا مادة مفاتيح**.

## السلوك
- `capabilities()` → `{ can_sign:false, can_send:false, mock:true }`.
- `requestSignature(intent)` → دائماً `{ signed:false, signature:null, is_valid_on_chain:false, note:'...not a signature, not valid on-chain' }` + `accepted` و(عند الرفض) `refusal_reason`.

## الرفض (refusal)
- أي `mode` غير `paper` (real/live/...) → `live_or_nonpaper_signing_refused`.
- وجود مادة مفاتيح في الطلب (`private_key`/`seed`/`mnemonic`/`keypair`/`secret`…) → `key_material_not_accepted` (ولا تُخزَّن).
- `signer_profile_id` مفقود → `missing_signer_profile_id` · `signer_profile_status` خارج SSOT → `invalid_signer_profile_status` · غير `ACTIVE` → `signer_not_active` · `key_custody_mode` خارج SSOT → `invalid_key_custody_mode`.

## الأسماء (SSOT G15 فقط)
`signer_profile_id` · `signer_profile_status` (ACTIVE/DISABLED/REVOKED/DEGRADED) · `key_custody_mode` (connected_wallet/isolated_signer). **لا `api_error_code` جديد** (`refusal_reason` سلسلة داخلية).

> **لا KeyManager حقيقي · لا signing library · لا transaction serialization/submit · لا RPC/providers · لا DB · لا قدرة تداول.** يبقى mock حتى تكتمل Key Management وreadiness قبل أي REAL-LIVE (خارج Gate B).
