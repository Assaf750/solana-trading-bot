# @soltrade/isolated-signer-runtime (Gate E / E2-1) — SKELETON ONLY

The **declared isolated-signer path** (`DECLARED_ALLOWLIST_PATHS`, PR-H4), now created as a **safe,
empty placeholder**. **Skeleton only — no behavior, no keys, no live mechanism, no signing authority.**

> **This is not an implementation.** No KMS/secret-vault, no KeyManager, no key custody, no private
> key/seed/keypair/mnemonic, no crypto/signing library, no transaction building/serialization, no
> signing/sending, no RPC/provider, no live transfer/sweep/funding, no DB writes, no REAL-LIVE activation,
> no execution authority.

## Allowlist status — NOT activated
The mechanism guard's `ALLOWLIST` stays `[]`. Although this path now **exists** and is **declared**
(`DECLARED_ALLOWLIST_PATHS`), it is **not activated**: this `src/` is **fully scanned** by the guard like
every other package, and **any live mechanism added here is rejected** until a future, separately-approved
PR moves the path into `ALLOWLIST`. Even then, **key material in source stays HARD-forbidden**
(`allowlisted_but_key_material:*`).

## Surface
```js
import { capabilities, describeIsolationBoundary } from '@soltrade/isolated-signer-runtime';
capabilities();              // { can_sign:false, can_send:false, has_key_material:false, live_mechanisms:false, allowlisted:false, status:'skeleton' }
describeIsolationBoundary(); // status/description object (text only)
```
Both return all-false, no-live-mechanism status objects. There is no `sign`/`send`/`serialize`/`loadKey`/`KeyManager` surface.

## Source of truth
- `docs/00-ARCHITECTURE.md` §4.3 (SignerService isolation) · `docs/09-THREAT-SECURITY.md` §3/§4 (isolation, custody boundary)
- `CONTRIBUTING.md` §5.1 (mechanism guard PR-H2/H3/H4: declaration-not-activation)

## Not in scope (forbidden here, and absent)
No allowlist activation · no KMS/vault · no KeyManager · no key custody · no key material ·
no crypto/signing library · no transaction building/serialization · no signing/sending ·
no RPC/Solana/Jupiter/Helius/Jito · no DB writes · no API/dashboard · no REAL-LIVE · no `candidate_*` promotion.
