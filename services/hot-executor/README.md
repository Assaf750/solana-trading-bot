# services/hot-executor — Rust hot path (Phase 2 — GATED)

The latency-critical core: decode → sign (ed25519) → build swap → submit → Jito
bundle. Rust for predictable tail latency (no GC pauses), with mature crates
(`solana-sdk`, `yellowstone-grpc`, `jito`).

Status: **Phase 2 — built (signer + submit/bundle/tip construction).** Owner directed a full
build-out regardless of the Phase 0 latency gate. Implemented:
- `signer.rs` — fee-payer-locked ed25519 signing, a faithful port of
  `apps/server/src/engine/tx-signer.mjs`; verified byte-identical to the Node signer.
- `submit.rs` — JSON-RPC `sendTransaction` body, Jito `sendBundle` body (≤5 tx, atomic, one
  slot), and tip selection from Jito `getTipFloor` percentiles (1000-lamport floor fallback).
  PURE: the TS control plane performs the actual POST with its existing RPC client + intent
  ledger, so idempotency-of-record stays in TS.

Ops (JSON-lines): `ping`, `sign`, `build_submit`, `build_bundle`, `select_tip`.

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
