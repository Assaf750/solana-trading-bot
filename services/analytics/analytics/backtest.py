"""Equity-curve backtest over the engine's realized exits — stdlib-only.

Reconstructs a cumulative realized-P&L curve and reports total, peak, and max drawdown — a
starting point for richer entry/exit replay backtests later. Read-only, off the hot path.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass

from .score_leaders import EXIT_KINDS, _num, default_events_path, load_events


@dataclass
class BacktestResult:
    exits: int
    total_realized_usd: float
    peak_equity_usd: float
    max_drawdown_usd: float


def run_backtest(events) -> BacktestResult:
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    exits = 0
    for ev in events or []:
        if ev.get("kind") not in EXIT_KINDS:
            continue
        realized = _num(ev.get("realized_usd"))
        if realized is None:
            continue
        exits += 1
        equity += float(realized)
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    return BacktestResult(exits, round(equity, 2), round(peak, 2), round(max_dd, 2))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Equity-curve backtest over the engine's exits.")
    ap.add_argument("--events", default=str(default_events_path()))
    args = ap.parse_args(argv)
    res = run_backtest(load_events(args.events))
    print(json.dumps(asdict(res), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
