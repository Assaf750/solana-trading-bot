# services/hot-executor — Rust hot path (Phase 2 — GATED)

The latency-critical core: decode → sign (ed25519) → build swap → submit → Jito
bundle. Rust for predictable tail latency (no GC pauses), with mature crates
(`solana-sdk`, `yellowstone-grpc`, `jito`).

Status: **Phase 2 — DO NOT BUILD YET.** This folder is intentionally empty of code
(no `Cargo.toml`, no `.rs`) until the gate below is satisfied.

## Gate (why this is deferred)
Build this ONLY after **Phase 0** (`GET /api/latency`) proves that **latency** —
not slippage, fees, or leader selection — is the binding constraint on
profitability for this operator's trade size. The deep-research evidence is
explicit: Rust hot path is a "only if competing on latency" investment, and
production engines (NautilusTrader) confine the compiled core to the hot path while
keeping orchestration in a scripting/control-plane language (here: TypeScript).

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
