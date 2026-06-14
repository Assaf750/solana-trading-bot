# Soltrade — methodical restructuring plan

Target: a polyglot architecture **split strictly by latency-sensitivity**. Evidence base: the
deep-research report (Yellowstone gRPC vs WebSocket, Jito bundles, NautilusTrader
compiled-core pattern, local AMM math). See sources at the end.

> **Owner directive (update):** the owner chose to build out the full target architecture in all
> three languages now, regardless of the Phase 0 latency gate. The gate (Phase 0) is still wired
> and useful, but it no longer blocks the Rust hot-executor. Build status below.

## Build status
- ✅ `apps/server` (TS control plane), `apps/operator-ui` (React), `packages/`, `infra/` — kept.
- ✅ Phase 0 latency gate — `latency-tracker.mjs` + `GET /api/latency` (live).
- ✅ `services/ingestor` (Node/TS, Yellowstone gRPC) — built, 4 tests in the root suite.
- ✅ `services/analytics` (Python, stdlib) — built, 4 unittest cases.
- ✅ `services/ingestor` — WIRED behind `subscribeWallets` (gRPC transport when configured, WS fallback).
- ✅ `services/hot-executor` (Rust) — signer (cross-verified vs Node) + submit/bundle/tip
  request construction; 8 cargo tests. TS does the network POST (idempotency stays in TS).
- ⏭️ Next: live HTTP submit wiring in TS via the Rust-built bodies; analytics over ClickHouse;
  optional self-hosted gRPC/ShredStream.

## Target architecture (north star)

| Path | Language | Why |
|------|----------|-----|
| `apps/operator-ui/` | React + Vite (TS) | presentation, off the hot path |
| `apps/server/` | TypeScript / Node | control plane: risk, state, API, ledger — not latency-bound |
| `services/ingestor/` | TS now → Rust later | Yellowstone/Geyser gRPC leader-trade ingestion |
| `services/analytics/` | Python | OFFLINE: leader/wallet scoring, backtesting, PnL over ClickHouse |
| `services/hot-executor/` | Rust | hot path: decode → sign → build → submit → Jito bundle |
| `packages/` | TypeScript | shared contracts/types |
| `infra/` | — | Postgres · ClickHouse · Redis |

Inter-service boundary: services talk to `apps/server` over gRPC or Redis streams
ONLY — never share business logic. Rust and Python stay as clean isolated services.

## Guiding principles
1. **Split by latency-sensitivity, not preference.** Hot path → compiled; control
   plane → TS; analytics → Python; UI → React.
2. **Measure before Rust.** `hot-executor` is built ONLY after Phase 0 proves
   latency (not slippage/fees/leader-selection) is the binding constraint.
3. **Keep what works.** TS control plane + 1860 passing tests, React UI, packages,
   infra all stay. No rewrite for its own sake.
4. **Reliability before speed.** The gRPC ingestion upgrade is justified by
   reliability alone (WebSocket disconnects under load = missed signals).
5. **One green guard.** Every increment keeps `node --test` green before commit.

## Phases

### Phase 0 — measure (the gate) · NOW · low risk
- Instrument the pipeline: `ingestion_lag_ms` (leader tx blockTime → our receipt)
  and `decision_ms` (receipt → order placed). Expose at `GET /api/latency`.
- DoD: `/api/latency` returns p50/p90/p99/max after real leader events; a few days
  of data answer: *is ingestion lag the bottleneck?*
- Decides Phase 2: if `ingestion_lag_ms` p90 is large → gRPC + Rust justified; if
  small → invest in leader selection (Python) instead.

### Phase 1 — now (high ROI, no language rewrite)
1. **`services/ingestor` — WebSocket → Yellowstone gRPC.** Start with a MANAGED
   gRPC endpoint (Helius/Triton/Chainstack), not a self-hosted node. The change is
   isolated behind the existing `subscribeWallets` interface in
   `apps/server/src/engine/rpc-client.mjs`. Biggest reliability+latency win.
2. **Jito bundles + dynamic tips** for time-sensitive exits: read `getTipFloor`
   live (never hardcode); re-verify post-BAM mechanics before shipping.
3. **`services/analytics` — Python sidecar.** Leader/wallet scoring + backtesting
   over ClickHouse. Fully async, zero hot-path coupling. Highest profitability ROI
   at current trade size (picking good wallets > shaving ms).

### Phase 2 — only if Phase 0 proves latency is the constraint
4. **`services/hot-executor` in Rust** (decode/sign/build/submit/bundle) as a
   standalone service the TS control plane calls over gRPC. Mature crates:
   `solana-sdk`, `yellowstone-grpc`, `jito` tip/bundle.
5. **ShredStream ingestion** for latency races (replaces/augments gRPC in ingestor).
6. **Local AMM math** to replace Jupiter HTTP: CPMM/bonding-curve (`x·y=k` + all fee
   components + Token-2022) is easy; CLMM/concentrated (tick traversal) is hard —
   do CPMM first. Keep Jupiter HTTP until then.

### Keep unchanged
TS control plane (`apps/server`), React UI, `packages/` contracts,
Postgres/ClickHouse/Redis.

## Honest limits (carried from the audit + research)
- Several latency numbers are vendor self-reports; the ordering (ShredStream > gRPC
  > RPC) is robust, exact ms are soft.
- Jito mechanics changed with BAM (mainnet Sep 2025) — re-verify before tip logic.
- Local CPMM fee handling is more than headline `x·y=k`.
- Real-money activation and owner-only secrets/funds remain owner-driven.

## Sources
- Triton / Yellowstone gRPC: https://blog.triton.one/complete-guide-to-solana-streaming-and-yellowstone-grpc/
- Chainstack ShredStream: https://chainstack.com/how-to-improve-solana-rpc-latency-with-shredstream/
- RPC Fast tiers: https://rpcfast.com/blog/shredstream-vs-geyser-vs-standard-rpc
- Jito low-latency send: https://docs.jito.wtf/lowlatencytxnsend/
- NautilusTrader (compiled-core pattern): https://github.com/nautechsystems/nautilus_trader
- Raydium CLMM vs CPMM: https://docs.raydium.io/raydium/concepts/concentrated-vs.-constant-product
- Solana MEV protection: https://solana.com/developers/guides/advanced/mev-protection
