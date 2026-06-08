# @soltrade/custody-provider-contract

**Gate E / E2-A — Custody Provider CONTRACT + STUB. Interface only. This is NOT a KMS integration.**

This package defines *what a custody provider must be* and ships a *provider-selection stub*. It contains
**no live mechanism**: no KMS/vault client, no `KeyManager`, no crypto/signing library, no key material, no
transaction building/serialisation, no signing/sending, no RPC/provider calls, no DB. It performs no work and
holds nothing.

## E2-KMS-1 — opaque key-handle interface (interface-only, no real provider, no KMS SDK)
`describeKeyHandleContract()` / `resolveCustodyKeyHandle()` (and `provider.resolveKeyHandle()`) add an
**interface only** for a custody/KMS key handle: an **opaque, non-exportable** handle that never exposes a raw
private key, has **no export method and no signing method**, and refuses raw key/seed/mnemonic/keypair input.
There is **no real handle** — resolution is **always fail-closed** (`ok:false`, `handle:null`,
`status:'unconfigured'`, `recommended_signer_profile_status:'DEGRADED'`). **No real provider, no KMS/Vault SDK,
no network, no signing here.** A real KMS-backed adapter is a separate, explicitly-approved PR.

## E2-KMS-4 — provider adapter skeleton (no SDK, fail-closed)
`createProviderAdapterSkeleton(config)` is a **contract-shaped** provider adapter with **no SDK, no network, no
live provider, no key material**. It is **never configured** (`isConfigured() === false`, `has_sdk:false`), so
`resolveKeyHandle()` is **always fail-closed** (`handle:null`, `recommended_signer_profile_status:'DEGRADED'`,
reasons `skeleton_no_sdk` / `config_invalid_key_material` / `key_material_not_accepted`). `config` is
reference-only (`provider_ref`); key-material in `config` or `request` is refused and never echoed. There are
**no `sign`/`exportKey` methods**. A real KMS-backed adapter is a separate, explicitly-approved PR.

## Why a standalone package (not inside the isolated signer runtime)
A pure contract/stub has no live mechanism, so it lives **outside** the mechanism guard's allowlist and is
**fully scanned** — proving it carries zero forbidden families. The allowlisted path
(`packages/isolated-signer-runtime/src/`) is reserved for *future, separately-approved live* custody/signing
code; a no-op contract does not belong there.

## Contract
A conforming custody provider is an **opaque** component that:
- **never exports key material** (`can_export_key: false`),
- **holds no key material in this contract/stub** (`holds_key_material: false`),
- cannot sign or send (`can_sign: false`, `can_send: false`),
- **refuses key-material input** (`accepts_key_material_input: false`),
- is **fail-closed**: every operation resolves to `{ ok: false, status: 'unconfigured' }` until a real,
  separately-approved provider is integrated.

## API (contract/stub)
- `describeCustodyProviderContract()` → frozen capability descriptor (all execution capabilities `false`).
- `createUnconfiguredCustodyProvider()` → opaque provider; `describe()/health()/use()` are fail-closed;
  `use()` **refuses** key-material input (never accepts/stores/returns it).
- `selectCustodyProvider(selection?)` → **stub**: always resolves to the unconfigured provider; never a live one.
- `refusesKeyMaterial(input?)` → predicate used to assert refusal behaviour.

## Failure model
`unconfigured` is the only state. There is no configured/live branch. No operation does I/O, crypto, or signing.

## Explicitly NOT in this package
KMS/Vault integration · KeyManager · crypto/signing library · private keys/seeds/keypairs/mnemonics/test
wallets · transaction building/serialisation · signing/sending · RPC/Solana/Jupiter/Helius/Jito · provider
live calls · DB writes · REAL-LIVE activation · execution authority · any `ALLOWLIST`/allowlist-path change.

## Next steps (each a separate, explicitly-approved PR)
E2-B custody load/use/zeroize integration (allowlisted path) · E2-C signing implementation · E2-D
audit-before/after · E2-E readiness + fail-closed `DEGRADED` · E2-F testnet-only proof · E2-G closure.
**REAL-LIVE activation is a separate later decision and is not started by any of these.**
