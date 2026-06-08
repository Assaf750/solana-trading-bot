# H5 — Allowlist Activation DRY-RUN Evidence (test/report-only)

> **TEST/REPORT-ONLY.** No guard-core change, no runtime package, no `ALLOWLIST` change, no path added to the
> allowlist, no KMS/vault, no KeyManager, no crypto/signing library, no keys, no signing/sending, no execution
> authority. References existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> **This is a DRY-RUN, not B8 activation.** It proves that activating the declared allowlist path is *testable in
> theory* without actually activating it. "Activation" here is **simulated purely by passing an explicit
> `allowlist` parameter** into the guard's public API — the real module-level `ALLOWLIST` stays `[]` and is never
> modified. **B8 (allowlist activation) remains `BLOCKED`; E2 implementation remains NO-GO.**
>
> **State:** `main` @ `b666e97` · `ALLOWLIST=[]` · B1–B7 `DECIDED`, B8 `BLOCKED`.
> **Companion to:** `tools/check-mechanism-guards.h5.dryrun.test.mjs` (the executable evidence),
> `tools/check-mechanism-guards.mjs` (guard, unchanged), `reports/E2-CUSTODY-OPS-POLICY.md` (B8 checklist).

---

## 1. What this PR is / is not
- **Is:** one new test file (`tools/check-mechanism-guards.h5.dryrun.test.mjs`) plus this report. The test
  exercises the guard's existing public API (`runMechanismGuard`, `scanText`, `isAllowlisted`,
  `collectSourceFiles`, `ALLOWLIST`, `DECLARED_ALLOWLIST_PATHS`) — all already exported.
- **Is not:** a change to `tools/check-mechanism-guards.mjs` (guard core), to `ALLOWLIST`, to
  `DECLARED_ALLOWLIST_PATHS`, to B8, or to any runtime package. **No real activation occurs.**

## 2. Simulated vs real activation (the key distinction)
| | Real state (production guard) | Simulated (this dry-run) |
|---|---|---|
| Source | module-level `ALLOWLIST` | `allowlist` **parameter** passed to the function |
| Value | `Object.freeze([])` (empty) | `[...DECLARED_ALLOWLIST_PATHS]` (param only) |
| Effect | nothing exempt; fail-closed everywhere | declared path exempt **inside the call only** |
| Persistence | n/a | none — the parameter does not mutate `ALLOWLIST` |
| B8 status | **BLOCKED** | **still BLOCKED** (a parameter is not activation) |

Activation (B8) would mean moving `DECLARED_ALLOWLIST_PATHS` into the real `ALLOWLIST`. **That is not done here.**
The dry-run passes the allowlist as a transient argument, and asserts in the same run that `ALLOWLIST.length === 0`
and `runMechanismGuard().counts.allowlist === 0` immediately afterward — proving no bleed-through.

## 3. The seven proofs (each an executable test)
| # | Proof | Test |
|---|---|---|
| 1 | The real `ALLOWLIST` is `[]`; the active guard runs at `allowlist=0` and PASSES. | `H5.1` |
| 2 | `packages/isolated-signer-runtime/src/` **exists** (scanned) but is **not activated** — the real allowlist exempts no file. | `H5.2` |
| 3 | A live mechanism at the declared path **FAILS** under the real empty allowlist (`solana-sdk-import`, `tx-send`). | `H5.3` |
| 4 | The **same** content is exempt **only** when an allowlist is passed as a **parameter**; the real guard still fails on it, and `ALLOWLIST` stays `[]` (simulated count ≠ real count, no bleed-through). | `H5.4` |
| 5 | **Key material stays HARD-forbidden even inside the simulated allowlisted path** (`allowlisted_but_key_material:*` for PEM / base58 blob / mnemonic). | `H5.5` |
| 6 | Live mechanisms **outside** the declared path stay rejected even with the simulated allowlist active (sdk/crypto import, sign, send, serialize, rpc-connection, KeyManager, real-live-activation-call, keypair-material). | `H5.6` |
| 7 | Closing invariant: the dry-run leaves the repo **fully closed** — real guard PASS at `allowlist=0`, B8 not activated. | `H5.7` |

## 4. What this proves about activation readiness
- The activation *mechanism* (allowlist-as-parameter) behaves correctly **in simulation**: it would exempt the
  declared path's live mechanisms **and nothing else**, while **never** exempting key material.
- Because the same behavior is reachable purely through a parameter, **a future B8 activation is testable in
  advance** without ever flipping the real switch.
- **Activation itself is still a separate governance decision (B8).** This evidence does not grant it.

## 5. What stays NO-GO
- `ALLOWLIST=[]` (unchanged). **B8 remains `BLOCKED`.** **E2 implementation remains NO-GO.**
- No KMS/Vault, no KeyManager, no crypto/signing library, no keys/seeds, no signing/sending, no
  transaction building/serialization, no RPC/provider calls, no DB writes, no REAL-LIVE activation.
- The mechanism guard remains **fail-closed**: with the real empty `ALLOWLIST`, every live mechanism in every
  path (including the declared skeleton path) is rejected.

## 6. Checklist impact
- **B1–B7:** remain `DECIDED` (this PR ratifies nothing and changes no checklist status).
- **B8:** remains `BLOCKED` (dry-run is not activation).
- **Aggregate:** **NOT READY / NO-GO** — unchanged.

---

**Confirmations:** Test/report-only · E2 implementation remains NO-GO · No real allowlist activation (the declared
path is not added to `ALLOWLIST`) · No KMS/Vault/KeyManager introduced · No key material introduced · No execution
authority introduced.
