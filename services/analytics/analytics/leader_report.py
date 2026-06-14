"""Richer leader analytics: per-wallet quality metrics, an optional recency window, and a
recommended follow / drop / watch set. Offline, read-only, stdlib-only. Builds on the
score_leaders join logic. This is the highest-ROI lever for a small operator: copying better
wallets matters more than shaving milliseconds. Advises only — the control plane stays authoritative.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .score_leaders import ENTRY_KINDS, EXIT_KINDS, _num, default_events_path, load_events


@dataclass
class LeaderMetrics:
    leader_address: str
    trades: int
    wins: int
    losses: int
    win_rate: float
    total_realized_usd: float
    avg_realized_usd: float
    gross_profit_usd: float
    gross_loss_usd: float
    profit_factor: float | None  # None = no losses yet (undefined)
    avg_win_usd: float
    avg_loss_usd: float
    best_usd: float
    worst_usd: float
    last_exit_ts: str | None
    score: float


def parse_ts(s):
    if not isinstance(s, str):
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    # normalize naive timestamps to UTC so window comparison never raises aware-vs-naive TypeError
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def leader_metrics(events, now=None, window_days=None):
    """Per-leader quality metrics. When (now, window_days) are given, only exits whose ts falls in
    [now - window_days, now] are counted (entries always map position->leader, regardless of age)."""
    events = list(events or [])
    pos_leader = {}
    for ev in events:
        if ev.get("kind") in ENTRY_KINDS:
            pid = ev.get("position_id")
            leader = ev.get("leader") or ev.get("leader_address")
            if pid and leader:
                pos_leader[pid] = leader

    cutoff = None
    if window_days is not None and now is not None:
        cutoff = now - timedelta(days=window_days)

    # aggregate per POSITION first (partial sells share a position_id -> one trade, net P&L),
    # applying the recency window per exit chunk; then roll positions up per leader.
    pos = defaultdict(lambda: {"leader": None, "total": 0.0, "last": None})
    for ev in events:
        if ev.get("kind") not in EXIT_KINDS:
            continue
        realized = _num(ev.get("realized_usd"))
        pid = ev.get("position_id")
        leader = pos_leader.get(pid)
        if leader is None or realized is None:
            continue
        ts = parse_ts(ev.get("ts"))
        if cutoff is not None and (ts is None or ts < cutoff):
            continue
        d = pos[pid]
        d["leader"] = leader
        d["total"] += float(realized)
        if ts is not None and (d["last"] is None or ts > d["last"]):
            d["last"] = ts

    agg = defaultdict(lambda: {"r": [], "last": None})
    for d in pos.values():
        a = agg[d["leader"]]
        a["r"].append(d["total"])
        if d["last"] is not None and (a["last"] is None or d["last"] > a["last"]):
            a["last"] = d["last"]

    out = []
    for leader, a in agg.items():
        rs = a["r"]
        n = len(rs)
        wins = [x for x in rs if x > 0]
        losses = [x for x in rs if x < 0]
        total = sum(rs)
        gross_profit = sum(wins)
        gross_loss = -sum(losses)
        win_rate = len(wins) / n if n else 0.0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else None
        out.append(
            LeaderMetrics(
                leader_address=leader,
                trades=n,
                wins=len(wins),
                losses=len(losses),
                win_rate=round(win_rate, 4),
                total_realized_usd=round(total, 2),
                avg_realized_usd=round(total / n, 2) if n else 0.0,
                gross_profit_usd=round(gross_profit, 2),
                gross_loss_usd=round(gross_loss, 2),
                profit_factor=round(profit_factor, 3) if profit_factor is not None else None,
                avg_win_usd=round(sum(wins) / len(wins), 2) if wins else 0.0,
                avg_loss_usd=round(sum(losses) / len(losses), 2) if losses else 0.0,
                best_usd=round(max(rs), 2) if rs else 0.0,
                worst_usd=round(min(rs), 2) if rs else 0.0,
                last_exit_ts=a["last"].isoformat() if a["last"] else None,
                score=round(total * (0.5 + 0.5 * win_rate), 2),
            )
        )
    out.sort(key=lambda m: m.score, reverse=True)
    return out


def recommend_follow_set(metrics, *, min_trades=5, min_profit_factor=1.2):
    """Split leaders into follow / drop / watch. follow = enough sample + net positive + healthy
    profit factor; drop = enough sample + net negative (proven loser); watch = everything else."""
    follow, drop, watch = [], [], []
    for m in metrics:
        if m.trades < min_trades:
            watch.append(m.leader_address)
            continue
        pf_ok = m.profit_factor is None or m.profit_factor >= min_profit_factor
        if m.total_realized_usd > 0 and pf_ok:
            follow.append(m.leader_address)
        elif m.total_realized_usd < 0:
            drop.append(m.leader_address)
        else:
            watch.append(m.leader_address)
    return {"follow": follow, "drop": drop, "watch": watch}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Per-leader quality metrics + recommended follow set.")
    ap.add_argument("--events", default=str(default_events_path()))
    ap.add_argument("--window-days", type=float, default=None)
    ap.add_argument("--min-trades", type=int, default=5)
    ap.add_argument("--min-profit-factor", type=float, default=1.2)
    ap.add_argument("--out", default="leader_report.json")
    args = ap.parse_args(argv)
    now = datetime.now(timezone.utc)
    metrics = leader_metrics(load_events(args.events), now=now, window_days=args.window_days)
    rec = recommend_follow_set(metrics, min_trades=args.min_trades, min_profit_factor=args.min_profit_factor)
    payload = {
        "window_days": args.window_days,
        "leaders": [asdict(m) for m in metrics],
        "recommendation": rec,
    }
    Path(args.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        f"reported {len(metrics)} leader(s); "
        f"follow={len(rec['follow'])} drop={len(rec['drop'])} watch={len(rec['watch'])} -> {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
