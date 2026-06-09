# E2 Stage-3 / PR-S3-A — Gate-A Config Validation + Audit Path Foundation Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/gate-a-foundations`** package and adds two read-only, fail-closed Gate-A foundations:
> **Config Validation** (Part C) and **Audit Path** (Part D). Both are pure, import-free, function-I/O-only
> contracts whose results **never open trading readiness** — every trading/exec flag is fixed `false`. **No
> network primitive, no system clock, no dependency, no endpoint/secret in repo, no send/broadcast/serialize/
> signing, no mainnet, no REAL-LIVE.** `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `08c3f28` (branch `pr-s3-a-gate-a-config-audit-foundation`) · B1–B8 `DECIDED` ·
> aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=85 fixtures=27 allowlist=1 violations=0` · full suite **882/882**.

---

## 1. New package
`packages/gate-a-foundations/` — `package.json` (no dependencies), `src/index.mjs` (`export *`), `src/index.d.ts`,
`src/gate-a-foundations.mjs`, `src/gate-a-foundations.d.ts`, `test/gate-a-foundations.test.mjs`, `README.md`.
Import-free, pure, function-I/O-only; results are `Object.freeze` of fixed literals.

## 2. Config Validation (Part C)
- `describeGateAConfigValidationContract()` · `validateGateAConfig(config)` · `evaluateGateAConfigReadiness(config)`.
- States: `CONFIG_UNCONFIGURED` / `CONFIG_INVALID` / `CONFIG_VALID_READ_ONLY` / `CONFIG_DEGRADED`.
- Mapping: not-object/null/hostile → `CONFIG_UNCONFIGURED`; no required attestations → `CONFIG_UNCONFIGURED`;
  some-but-not-all required → `CONFIG_DEGRADED`; all required true + testnet env → `CONFIG_VALID_READ_ONLY`;
  smuggled trading/exec flag, secret string field, or mainnet/non-testnet env → `CONFIG_INVALID` (fail-closed).
- Reads no secret/env/file; makes no network call. `config_valid_read_only:true` **only** for `CONFIG_VALID_READ_ONLY`.

## 3. Audit Path (Part D)
- `describeGateAAuditPathContract()` · `validateGateAAuditEnvelope(envelope)` · `evaluateGateAAuditPath(envelope)`.
- States: `AUDIT_UNCONFIGURED` / `AUDIT_INVALID` / `AUDIT_DEGRADED` / `AUDIT_PATH_VALID`.
- A valid test-only envelope carries non-hidden `decision_ref` + `actor_ref` + `reason_code` (+ opaque
  `created_at_ref`) and attests `audit_required` / `no_secret_material` / `no_private_key_material` /
  `no_live_execution` = true. **Audit cannot be bypassed and a decision/reason is never hidden:** a missing
  `decision_ref`/`actor_ref`/`reason_code` → `AUDIT_INVALID`. A secret/private-key/token field (string value),
  smuggled execution flag → `AUDIT_INVALID`, and the value is **never echoed**. `audit_path_valid:true` **only**
  for `AUDIT_PATH_VALID`.

## 4. Defect found & fixed during build (transparent)
The build workflow's test-agent + behavioral-agent caught a real defect: the secret-field screen
(`gateAHasSecretField`) matched the secret pattern against **key names**, so the *required* attestation keys
`no_secret_material` (contains "secret") and `no_private_key_material` (contains "private") false-tripped
`secret_field_blocked` — making `AUDIT_PATH_VALID` unreachable for any spec-conformant envelope. **Fix:** a field
carries secret *material* only if its name matches the secret pattern **and its value is a string** payload; a
boolean attestation (`no_secret_material:true`) is a safe assertion, not material. This blocks the real cases
(`api_key`/`token`/`private_key`/`auth_token` carrying a string) and never echoes the value, while letting a valid
envelope reach `AUDIT_PATH_VALID`. Re-verified GREEN.

## 5. Health/config/audit ≠ trading readiness
Every describe/validate/evaluate result spreads a shared invariant-flags object with **all** of `trading_ready`,
`routing_ready`, `can_send`, `can_broadcast`, `can_serialize`, `signing_permitted`, `broadcast_permitted`,
`is_live`, `real_live`, `mainnet_enabled`, `has_rpc` fixed `false` — on **every** state. No code path sets any
true (the `.d.ts` pins each to the literal type `false`). A `CONFIG_VALID_READ_ONLY` / `AUDIT_PATH_VALID` result
is **read-only only** and grants no trading/send/broadcast/signing/routing authority.

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/forbidden input → fail-closed `*_UNCONFIGURED`/`*_INVALID`;
secret/endpoint values never echoed (results are fixed literals + state + fixed reason tokens); hostile/throwing
input (Proxy) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 7. Tests summary
New `test/gate-a-foundations.test.mjs` — 30 proofs (C1–C12 config, D1–D12 audit, G1–G2 descriptors, S1–S4 static
guards). **gate-a-foundations suite 30/30; send-gate-contract 85/85 (continuity); full suite 882/882.** Independent
main-loop behavioral spot-check of the fix: 8/8 PASS.

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged (`Object.freeze(['packages/isolated-signer-runtime/src/'])`). Mechanism guard PASS
`sources=85 fixtures=27 allowlist=1 violations=0` — **`sources` rose 83 → 85** (the two new src `.mjs` files
`index.mjs` + `gate-a-foundations.mjs`), which is the expected, benign effect of adding a package; **`allowlist=1`
and `violations=0` unchanged**. SSOT drift **unchanged at baseline** (`core=31 api=6 config=63 data=152 mig=4
candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).

## 9. No-live / no-SDK / no-secret confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no SDK/dependency; no endpoint URL/secret in src/README; no send/broadcast/serialize/signing; no
KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; Gate-A config/audit validity is **not** trading readiness; `can_send:false` repo-wide
unchanged.

---

**Confirmations:** New `gate-a-foundations` package · Gate-A config validation (read-only, fail-closed) · Gate-A
audit path (read-only, fail-closed, cannot be bypassed, never hides a decision) · Config/audit are NOT trading
readiness (all trading/exec flags fixed false) · No network primitive · No system clock · No dependency · No
endpoint/secret in repo · No secret echoed · No send/broadcast/serialize/signing · No KMS/Vault/KeyManager · No
private key material · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false`
unchanged · send-gate-contract green.
