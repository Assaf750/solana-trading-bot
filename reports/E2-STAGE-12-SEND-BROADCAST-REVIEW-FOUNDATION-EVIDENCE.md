# E2 Stage-12 — Send/Broadcast-Review Foundation — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/send-broadcast-review-foundations`** package — the read-only/advisory **send/broadcast-review** layer
> of the pipeline `data → signal → risk → intent → route → sign → send`, derived from the Stage-11
> `SIGNING_REVIEW_PASS_ADVISORY` outputs. It **descriptively reviews send/broadcast PREREQUISITES from safe metadata
> only**; it is **NOT sending, NOT broadcasting, NOT an RPC call, NOT a serialized transaction, NOT a signature, NOT
> a send/broadcast permission, NOT send/broadcast readiness.** `can_send` / `can_broadcast` / `broadcast_permitted`
> stay false. The pre-existing fail-closed `send-gate-contract` is untouched and still refuses. Eight foundations
> (Parts C–J), 20 exports, delivered as one PR.
>
> **State:** built on `main` @ `ce262ec` (branch `pr-s12-send-broadcast-review`, `main + 1`, parent == main) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` unchanged · mechanism guard `sources=103 fixtures=27
> allowlist=1 violations=0` · SSOT drift EXACT baseline · full suite **1579/1579** · send-broadcast-review-foundations
> **76/76** · independent main-loop spot-check **82/82**.

---

## 1. New package
`packages/send-broadcast-review-foundations/` (`@soltrade/send-broadcast-review-foundations`, v0.0.0, type module, no
dependencies) — `src/index.{mjs,d.ts}`, `src/send-broadcast-review-foundations.{mjs,d.ts}`, test, README. Import-free,
pure, function-I/O-only, deterministic, fail-closed. The `src` consumes prior-stage RESULTS passed in (import-free);
the test imports the **real** Stage-4→11 signing-review chain verbatim from the template to reach a real
`SIGNING_REVIEW_PASS_ADVISORY` verdict + signing-review health, then builds Stage-12 on top. Root `package.json` uses
the `packages/*` workspace glob, so no workspace edit was needed.

## 2. The eight foundations (Parts C–J)
| Part | Foundation | Key states |
|---|---|---|
| C | Send-Review Input Boundary | `SEND_REVIEW_INPUT_UNCONFIGURED/_INVALID/_DEGRADED/_VALID` |
| D | Sender / Provider Boundary | `SENDER_PROVIDER_UNCONFIGURED/_INVALID/_READ_ONLY_OK` |
| E | Candidate Send-Review Descriptor | `CANDIDATE_SEND_REVIEW_UNCONFIGURED/_INVALID/_REJECTED/_DEGRADED/_DESCRIPTOR` |
| F | Send-Readiness Advisory | `SEND_READINESS_UNCONFIGURED/_INVALID/_DEGRADED/_REJECTED/_ACCEPTABLE_ADVISORY` |
| G | Broadcast / Live Forbidden Surface Guard | `BROADCAST_SURFACE_UNCONFIGURED/_CLEAN/_BLOCKED` |
| H | Send-Review Verdict | `SEND_REVIEW_UNCONFIGURED/_DEGRADED/_BLOCKED/_PASS_ADVISORY` |
| I | Send-Review Suppression | `SEND_REVIEW_NOT_SUPPRESSED` / `SEND_REVIEW_SUPPRESSED` (always-suppressed) |
| J | Send-Review Health | `SEND_REVIEW_HEALTH_UNCONFIGURED/_DEGRADED/_REVIEWED_ADVISORY/_SUPPRESSED/_BLOCKED` |

20 exports. **Eligibility chains strictly off Stage-11:** the input boundary (C) consumes ONLY the signing-review
verdict + health and is eligible only when `signing_review_verdict.signing_review_state ===
'SIGNING_REVIEW_PASS_ADVISORY'` and the health is not BLOCKED/UNCONFIGURED. (The signing-review clean health path is
`SIGNING_REVIEW_HEALTH_SUPPRESSED` — by design, since the upstream suppression is always-suppressed — which is
accepted; only BLOCKED/UNCONFIGURED/DEGRADED fail-close.) Raw route/intent/risk/tx-build/event inputs passed directly
→ `raw_non_signing_review_input_refused` → `_INVALID`.

## 3. Send/broadcast-review ≠ send / broadcast / RPC / transaction
Every result spreads a shared `sendSafeFlags()`: `read_only:true` + the **24** exec/readiness flags = false (incl.
`can_send`, `can_broadcast`, `broadcast_permitted`, `network_call_made`, `endpoint_resolved`, `is_live`,
`mainnet_enabled`, `real_live`, `signer_ready`, `signing_permitted`, `transaction_ready`, `serialized_ready`) — on
**every** state including `_VALID`, `_READ_ONLY_OK`, `_ACCEPTABLE_ADVISORY`, `_PASS_ADVISORY`, `_REVIEWED_ADVISORY`.
No output carries an endpoint/url/serialized-tx/signed-tx/signature/message_bytes/private-key field. The sender source
(D) is a **disabled/read-only descriptor TAG only** (`mock_sender_metadata`/`fixture_sender_metadata`/`disabled_sender`/
`helius_sender_disabled`/`jito_sender_disabled`/`rpc_provider_disabled`) asserting `sender_disabled:true`,
`rpc_connected:false`, `endpoint_resolved:false`, `broadcast_performed:false`, `network_call_made:false`.

## 4. Broadcast / Live Forbidden Surface Guard (Part G) — the new security crux
`evaluateBroadcastForbiddenSurface()` scans **top-level keys only** against a frozen forbidden-NAME list
(`endpoint`/`endpoint_url`/`rpc_url`/`rpc_endpoint`/`provider_url`/`node_url`/`ws_url`/`wss_url`/`http_endpoint`/…/
`serialized_tx`/`serialized_transaction`/`signed_tx`/`signed_transaction`/`wire_transaction`/`raw_tx`/`raw_transaction`/
`tx_bytes`/`message_bytes`/`signature`/`signatures`/`broadcast_payload`/`send_payload`).
- Clean → `BROADCAST_SURFACE_CLEAN`, all detection booleans false.
- Endpoint-shaped name → `_BLOCKED` with `live_surface_detected:true`, `broadcast_material_detected:false`.
- Transaction/signature/payload-shaped name → `_BLOCKED` with `broadcast_material_detected:true` (analogous to the
  template guard's private_key-vs-signature-only split).
- **REDACTION PROVEN:** `forbidden_field_ref` = the matched **NAME only**; the planted VALUE is provably **absent
  from `JSON.stringify`** (verified for planted `endpoint`/`rpc_url`/`provider_url`/`ws_url`/`serialized_tx`/
  `signed_transaction`/`signature`/`message_bytes`/`raw_transaction` values). Detection booleans are DETECTION
  outputs (true == BLOCKED == safe), **not** readiness flags; a BLOCKED result keeps all 24 flags false.
- Hostile/uninspectable → `BROADCAST_SURFACE_UNCONFIGURED`, never throws.

## 5. Always-suppressed send/broadcast (Part I) + health (Part J)
`evaluateSendReviewSuppression()` **ALWAYS** emits `suppressed:true` carrying `not_send_authorized` /
`not_broadcast_authorized` / `not_execution_authorized` on **every** path (clean, blocked, hostile, missing).
Consequently the standard clean **health** path resolves to `SEND_REVIEW_HEALTH_SUPPRESSED`; `_REVIEWED_ADVISORY` is
reachable only with an explicit not-suppressed object and **still opens nothing** (all 24 flags false). The verdict
(H) `_PASS_ADVISORY` opens no `can_send`/`can_broadcast`/`broadcast_permitted` — "passed" is carried only by
`send_review_state`/`send_review_passed_advisory`.

## 6. send-gate-contract integration (test-level only)
The existing fail-closed `send-gate-contract` is **not** imported into src (src stays import-free). A test imports its
`evaluateSendPreflight` and asserts it **STILL returns `ok:false`/`can_send:false`/`can_broadcast:false`** alongside a
Stage-12 `SEND_REVIEW_PASS_ADVISORY` verdict — proving the review layer never relaxes the gate.

## 7. Verification
- **Build workflow (implementation + 4 review lenses + arbiter):** GREEN, 0 confirmed blockers. Arbiter independently
  re-ran all gates and probed all 8 evaluators × 8 hostile/planted inputs: every result frozen + `read_only:true`,
  all 24 flags false, no throws, planted forbidden VALUES absent from `JSON.stringify`, guard `forbidden_field_ref` =
  NAME only. (One build-time test initially failed — Part D didn't refuse a planted `serialized_tx`/`signature` field;
  fixed by adding a `SEND_FORBIDDEN_FIELD_NAMES` screen to D → `SENDER_PROVIDER_INVALID`. All 76 then passed.)
- **My independent main-loop verification:** full suite **1579/1579**; SSOT drift EXACT baseline; mechanism guard
  `sources=103 fixtures=27 allowlist=1 violations=0`; `can_send/can_broadcast/broadcast_permitted :true` absent
  repo-wide; src import-free; 20 exports present.
- **My independent behavioral spot-check: 82/82 PASS** (temp script, run then deleted) — Part-G guard redaction for
  9 planted endpoint/material values (each absent from `JSON.stringify`, `forbidden_field_ref` == NAME, endpoint-vs-
  material split correct), readiness ACCEPTABLE/REJECTED all-flags-false, verdict `PASS_ADVISORY` all-flags-false,
  suppression always carrying the three `not_*_authorized` (clean, blocked, AND missing input), health real-clean →
  SUPPRESSED / explicit-not-suppressed → REVIEWED_ADVISORY, and the send-gate still `ok:false`.

## 8. Governance / guard / scope
SSOT drift EXACT baseline (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83)
cmd=13 forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract
identifiers; bucket values overlapping SSOT enums (`helius`/`jito`/`active`/`disabled`/`none`/`low`/`medium`/`high`)
are consumed-only. `ALLOWLIST` single entry (line 121) unchanged; `tools/` and `docs/00`–`12` untouched; only the new
package was added; `sources` rose +2 (the two new src `.mjs` files).

---

**Confirmations:** New `send-broadcast-review-foundations` package (8 foundations C–J, 20 exports) · a send-review is
not sending / broadcasting / an RPC call / a serialized transaction / a signature / a send-broadcast permission · no
real send/broadcast/RPC/network · sender source disabled-tags-only (`rpc_connected:false`) · Broadcast/Live Forbidden
Surface Guard proven redacting NAME-only · send/broadcast always suppressed · all 24 exec/readiness flags false on
every state · fail-closed (never throws) · existing send-gate still refuses · no network/clock/persistence/dependency
· src import-free · no new SSOT name · ALLOWLIST unchanged · drift EXACT · `can_send`/`can_broadcast`/
`broadcast_permitted` false repo-wide · full suite 1579/1579 · package 76/76 · independent spot-check 82/82 · `docs/00`
–`12` untouched.
