"""Leader scoring from the engine event log — offline, read-only, stdlib-only.

Joins exit events (realized P&L) back to the entry event's leader, then ranks leaders by an
expectancy-style score so the control plane can prefer high-quality wallets to copy. The control
plane stays authoritative; this only advises. No third-party deps (pandas/ML optional, later).
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

ENTRY_KINDS = {"paper_entry", "live_entry", "reconciled_orphan_entry"}
EXIT_KINDS = {"paper_exit", "live_exit", "reconciled_exit"}


@dataclass
class LeaderScore:
    leader_address: str
    trades: int
    wins: int
    win_rate: float
    total_realized_usd: float
    avg_realized_usd: float
    score: float


def _num(v):
    """Return v if it is a real (non-bool) number, else None — guards against null/NaN-ish junk."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return v
    return None


def score_leaders(events: Iterable[dict]) -> list[LeaderScore]:
    events = list(events or [])
    pos_leader: dict[str, str] = {}
    for ev in events:
        if ev.get("kind") in ENTRY_KINDS:
            pid = ev.get("position_id")
            leader = ev.get("leader") or ev.get("leader_address")
            if pid and leader:
                pos_leader[pid] = leader

    agg = defaultdict(lambda: {"trades": 0, "wins": 0, "total": 0.0})
    for ev in events:
        if ev.get("kind") not in EXIT_KINDS:
            continue
        realized = _num(ev.get("realized_usd"))
        leader = pos_leader.get(ev.get("position_id"))
        if leader is None or realized is None:
            continue
        a = agg[leader]
        a["trades"] += 1
        a["total"] += float(realized)
        if realized > 0:
            a["wins"] += 1

    scores: list[LeaderScore] = []
    for leader, a in agg.items():
        n = a["trades"]
        win_rate = a["wins"] / n if n else 0.0
        avg = a["total"] / n if n else 0.0
        # expectancy-style: total realized weighted by win-rate confidence (0.5 .. 1.0)
        score = a["total"] * (0.5 + 0.5 * win_rate)
        scores.append(
            LeaderScore(
                leader_address=leader,
                trades=n,
                wins=a["wins"],
                win_rate=round(win_rate, 4),
                total_realized_usd=round(a["total"], 2),
                avg_realized_usd=round(avg, 2),
                score=round(score, 2),
            )
        )
    scores.sort(key=lambda s: s.score, reverse=True)
    return scores


def load_events(path) -> list[dict]:
    p = Path(path)
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, dict):
        return data.get("events", []) or []
    return data or []


def default_events_path() -> Path:
    # services/analytics/analytics/score_leaders.py -> repo root is parents[3]
    return Path(__file__).resolve().parents[3] / "data" / "engine-events.json"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Score followed leaders from the engine event log.")
    ap.add_argument("--events", default=str(default_events_path()))
    ap.add_argument("--out", default="leader_scores.json")
    args = ap.parse_args(argv)
    scores = score_leaders(load_events(args.events))
    payload = {"leader_scores": [asdict(s) for s in scores]}
    Path(args.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"scored {len(scores)} leader(s) -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
