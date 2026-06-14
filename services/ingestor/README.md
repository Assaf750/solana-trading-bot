# services/ingestor — leader-trade ingestion (Phase 1)

Replaces the WebSocket `logsSubscribe`/`transactionSubscribe` ingestion with
**Yellowstone/Geyser gRPC** (intra-slot streaming, reliable under load). Start with
a managed gRPC endpoint — do NOT self-host a node yet.

Status: **Phase 1 — to build.** Skeleton only.

## Contract with `apps/server`
Emits the SAME event shape the engine already consumes via `subscribeWallets`:

```
onLeaderActivity({ signature, tx })   // tx inline (no extra round-trip)
onUp({ provider })                    // stream connected
onGap()                               // stream down beyond recovery window
```

So the swap is isolated: the engine's `apps/server/src/engine/rpc-client.mjs`
`subscribeWallets` is reimplemented over gRPC behind the identical interface;
nothing downstream (swap-detector, risk-gates, executor) changes.

## Why
WebSocket waits until end-of-slot, drops under load, no server-side filtering. gRPC
streams account/tx updates within the slot. Justified by reliability alone. See
[RESTRUCTURE_PLAN.md](../../docs/RESTRUCTURE_PLAN.md).

## Boundary
Talks to `apps/server` only via the event callbacks above (in-process adapter now;
gRPC/Redis stream if split into its own process later). No business logic here —
detection/gating/execution stay in the TS control plane.
