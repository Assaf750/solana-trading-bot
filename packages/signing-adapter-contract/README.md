# @soltrade/signing-adapter-contract

**Gate E / E2-C1 — Signing Adapter CONTRACT + NO-OP adapter. Interface only. NOT real signing.**

This package defines *what a signing adapter must be* and ships a *no-op adapter*. It contains **no live
mechanism**: no crypto/signing library, no KMS/vault client, no `KeyManager`, no key material, no transaction
building/serialisation, no signing/sending, no RPC/provider calls, no DB. It performs no work and holds nothing.

## Why a standalone package (outside the isolated signer path)
A pure contract/no-op has no live mechanism, so it lives **outside** the mechanism guard's allowlist and is
**fully scanned** — proving it carries zero forbidden families. The allowlisted path
(`packages/isolated-signer-runtime/src/`) is reserved for *future, separately-approved* real signing code
(E2-C3+), not a no-op.

## Contract
A conforming signing adapter is a **fail-closed** component that:
- consumes an **already-validated preflight result** (`preflight_ok===true`, `signed===false`,
  `signature===null`, `can_send===false`, empty `blockers`, custody not `DEGRADED`) plus an **opaque custody
  handle** reference,
- **never exports key material** (`can_export_key: false`),
- cannot sign or send in this contract/no-op (`can_sign: false`, `can_send: false`),
- **refuses key-material input** and never stores/returns it,
- returns a fail-closed result `{ ok:false, status:'unconfigured', signed:false, signature:null, can_send:false }`
  until a real, separately-approved adapter (E2-C3) is integrated.

## API (contract/no-op)
- `describeSigningAdapterContract()` → frozen capability descriptor (all execution capabilities `false`).
- `createNoopSigningAdapter()` → `{ describe(), isConfigured()->false, sign(request) }`; `sign()` validates the
  preflight envelope and **always** returns fail-closed (even a valid preflight yields `signed:false`).
- `signingAdapterRefusesKeyMaterial(input)` → predicate used to assert refusal behaviour.

## Failure model
`unconfigured` is the only state. There is no configured/live branch. No operation does crypto, signing, I/O,
or serialisation.

## Explicitly NOT in this package
crypto/signing library · KMS/Vault integration · KeyManager · private keys/seeds/keypairs/mnemonics/test
wallets · transaction building/serialisation · signing/sending · RPC/Solana/Jupiter/Helius/Jito · provider
live calls · DB writes · REAL-LIVE activation · execution authority · any `ALLOWLIST`/allowlist-path change.

## Next steps (each a separate, explicitly-approved PR)
E2-C2 test-only mock signer (allowlisted path, no key) · **E2-C3 real signing library (governance gate)** ·
E2-C4 isolation/no-key-leak tests · E2-C5 sign-only testnet proof (no send) · E2-C6 closure.
**REAL-LIVE activation, transaction send, and mainnet are separate later decisions.**
