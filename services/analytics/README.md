# services/analytics — Python research sidecar (Phase 1)

OFFLINE analytics & ML, **never on the hot path**: leader/wallet scoring,
backtesting, PnL analytics over ClickHouse. Async, decoupled.

Status: **Phase 1 — to build.** Skeleton only.

## Responsibilities
- Score followed wallets (which leaders are worth copying — the real alpha).
- Backtest copy strategies over historical leader trades.
- PnL / drawdown analytics over the ClickHouse time-series.

## Contract with `apps/server`
- READS: ClickHouse (leader trades, quotes, fills) + the engine's persisted
  events/trades (read-only). Never writes to the live books.
- WRITES: a `leader_scores` table/feed the TS control plane MAY read to inform
  follow decisions. The control plane stays authoritative — analytics only advises.

## Boundary
Separate Python process. Communicates by reading ClickHouse and publishing scores
(table or Redis key). No synchronous call sits in any trading decision path — a
stale/missing score must never block or mis-time a trade.

## Why Python here (and ONLY here)
pandas/polars, scikit-learn/XGBoost, Jupyter — ideal for research. The GIL/GC make
it wrong for the hot path, but irrelevant offline. See
[RESTRUCTURE_PLAN.md](../../docs/RESTRUCTURE_PLAN.md).
