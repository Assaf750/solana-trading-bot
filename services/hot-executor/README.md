# services/hot-executor — Rust hot path (Phase 2 — GATED)

The latency-critical core: decode → sign (ed25519) → build swap → submit → Jito
bundle. Rust for predictable tail latency (no GC pauses), with mature crates
(`solana-sdk`, `yellowstone-grpc`, `jito`).

Status: **Phase 2 — built (signer core).** Owner directed a full build-out of the target
architecture regardless of the Phase 0 latency gate. Implemented so far: the fee-payer-locked
ed25519 signer (the latency-critical crypto), a faithful Rust port of
`apps/server/src/engine/tx-signer.mjs`, exposed over a JSON-lines stdin/stdout contract.
Verified byte-identical to the Node signer (same signature, address, signed tx) and refuses a
fee-payer mismatch. Next: RPC submit + Jito bundle/tip.

## Run
`cargo build` then pipe JSON requests: `echo '{"op":"ping"}' | ./target/debug/hot-executor`.
Tests: `cargo test` (4 pass). `cargo test`/`cargo build` are local — not in the Node CI.

## Build order rationale
The signer was ported first because it is the genuinely latency-sensitive, well-specified core
(a known JS reference to verify against). Production engines (NautilusTrader) confine the
compiled core to the hot path while orchestration stays in a control-plane language (here:
TypeScript) — so risk/sizing/kill-switch/ledger remain in `apps/server`.

## When built — contract with `apps/server`
A standalone service the TS control plane calls over gRPC:

```
ExecuteSwap(side, mint, sizeUsd|qtyUi, slippageBps, intent_id) -> { signature, fill, status }
```

It owns ONLY mechanical execution + idempotency. Risk gates, sizing, kill-switch,
operating-state, and the intent ledger of record stay in the TS control plane —
the executor refuses anything not already gated. Signing keys remain owner-supplied
(vault), never embedded.

See [RESTRUCTURE_PLAN.md](../../docs/RESTRUCTURE_PLAN.md).
