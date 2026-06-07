# @soltrade/execution-wallet-admission (Gate C / C2)

Admission Gate for the `activate_execution_wallet` command. **MOCK / in-memory.** It is the
gate that flips an execution wallet from `WARMING_UP` to `ACTIVE` — and nothing more.

> **Admission is not signing, and not sending.** No transaction is built, signed, or sent here.
> No key material, no `KeyManager`, no signing library, no RPC/provider, no DB writes,
> no REAL-LIVE activation, no execution authority.

## Source of truth
- `docs/01-SSOT.md` G10 (validation outputs) · G11 (`permission_role`, `api_error_code`, command identity) · G15 (`execution_wallet_status`, `signer_profile_status`, `key_custody_mode`)
- `docs/02-CONFIG-AND-POLICY-SCHEMA.md` §6 (Hard Risk completeness → `real_live_config_valid`)
- `docs/03-API-CONTRACT.md` §12.1 (`activate_execution_wallet`)
- `docs/05-DATA-MODEL.md` §4.7 (execution_wallets) · §4.8 (signer_profiles)

## API
```js
import { createAdmissionGate } from '@soltrade/execution-wallet-admission';

const gate = createAdmissionGate({ walletRegistry, signerRegistry }); // C0 + C1 registries
const res = gate.activateExecutionWallet(request);
// -> { ok, admitted, command?, execution_wallet_status?, reason?, api_error_code? }
```

## Fail-safe gating order (any miss ⇒ reject, never ACTIVE)
1. **Permission** — `permission_role` must be `admin` (or `signer_control`); `signer_control`
   required when the request links a signer / changes custody. Else `PERMISSION_DENIED`.
2. **Wallet** — registered (C0) and in `WARMING_UP`. Else `COMMAND_NOT_ALLOWED_IN_STATE`.
3. **Signer** — registered (C1) and `ACTIVE`. Else `COMMAND_NOT_ALLOWED_IN_STATE`.
4. **Mock readiness** — `key_custody_mode` present + `key_custody_verified === true` +
   `funded === true` + `signer_reachable === true`. Each is a mock predicate; any false/missing rejects.
5. **Hard Risk completeness** — `validateConfig({ risk_config }).real_live_config_valid === true`
   (no implicit infinity). Else `REAL_LIVE_CONFIG_INVALID`.

Only when **all** pass does the gate call `walletRegistry.transition(id, 'ACTIVE')`.

## Not in scope (forbidden here)
No signing/sending · no `KeyManager` · no private key / seed / keypair / mnemonic ·
no signing library · no transaction building/serialization · no RPC / Solana / Jupiter / Helius / Jito ·
no DB writes / migrations · no API / dashboard · no REAL-LIVE activation · no Gate D/E ·
no `asset_transfer` / `wallet_rotation` / `profit_sweep` · no `candidate_*` promotion.
