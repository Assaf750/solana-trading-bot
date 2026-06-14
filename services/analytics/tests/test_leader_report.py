"""Stdlib unittest: per-leader metrics, recency window, recommended follow set."""
import unittest
from datetime import datetime, timezone

from analytics.leader_report import leader_metrics, parse_ts, recommend_follow_set

NOW = datetime(2026, 6, 14, tzinfo=timezone.utc)


def _events():
    return [
        {"kind": "paper_entry", "position_id": "p1", "leader": "A"},
        {"kind": "paper_entry", "position_id": "p2", "leader": "A"},
        {"kind": "paper_entry", "position_id": "p3", "leader": "A"},
        {"kind": "paper_entry", "position_id": "p4", "leader": "B"},
        {"kind": "paper_entry", "position_id": "p5", "leader": "B"},
        {"kind": "paper_exit", "position_id": "p1", "realized_usd": 100.0, "ts": "2026-06-13T00:00:00.000Z"},
        {"kind": "paper_exit", "position_id": "p2", "realized_usd": -40.0, "ts": "2026-06-13T00:00:00.000Z"},
        {"kind": "paper_exit", "position_id": "p3", "realized_usd": 20.0, "ts": "2026-06-01T00:00:00.000Z"},  # old
        {"kind": "paper_exit", "position_id": "p4", "realized_usd": -10.0, "ts": "2026-06-13T00:00:00.000Z"},
        {"kind": "paper_exit", "position_id": "p5", "realized_usd": -20.0, "ts": "2026-06-13T00:00:00.000Z"},
    ]


class LeaderReportTest(unittest.TestCase):
    def test_metrics(self):
        m = {x.leader_address: x for x in leader_metrics(_events(), now=NOW)}
        a = m["A"]
        self.assertEqual(a.trades, 3)
        self.assertEqual((a.wins, a.losses), (2, 1))
        self.assertEqual(a.total_realized_usd, 80.0)        # 100 - 40 + 20
        self.assertEqual(a.gross_profit_usd, 120.0)
        self.assertEqual(a.gross_loss_usd, 40.0)
        self.assertEqual(a.profit_factor, 3.0)
        self.assertEqual(a.avg_win_usd, 60.0)
        self.assertEqual(a.avg_loss_usd, -40.0)
        self.assertEqual((a.best_usd, a.worst_usd), (100.0, -40.0))
        b = m["B"]
        self.assertEqual(b.profit_factor, 0.0)              # losses only -> gross_profit 0 / gross_loss>0
        self.assertEqual(b.total_realized_usd, -30.0)

    def test_window_excludes_old_exits(self):
        m = {x.leader_address: x for x in leader_metrics(_events(), now=NOW, window_days=7)}
        self.assertEqual(m["A"].trades, 2)                  # p3 (2026-06-01) excluded
        self.assertEqual(m["A"].total_realized_usd, 60.0)

    def test_recommend_follow_drop_watch(self):
        metrics = leader_metrics(_events(), now=NOW)
        rec = recommend_follow_set(metrics, min_trades=2, min_profit_factor=1.2)
        self.assertIn("A", rec["follow"])
        self.assertIn("B", rec["drop"])
        # raising the sample floor pushes everyone to watch
        rec2 = recommend_follow_set(metrics, min_trades=99)
        self.assertEqual(rec2["follow"], [])
        self.assertEqual(sorted(rec2["watch"]), ["A", "B"])

    def test_parse_ts(self):
        self.assertIsNotNone(parse_ts("2026-06-14T00:00:00.000Z"))
        self.assertIsNone(parse_ts("nope"))
        self.assertIsNone(parse_ts(None))


if __name__ == "__main__":
    unittest.main()
