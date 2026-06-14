"""Stdlib unittest (no pytest needed): leader scoring + backtest invariants."""
import unittest

from analytics.backtest import run_backtest
from analytics.score_leaders import score_leaders


def _events():
    return [
        {"kind": "paper_entry", "position_id": "p1", "leader": "A"},
        {"kind": "paper_entry", "position_id": "p2", "leader": "A"},
        {"kind": "paper_entry", "position_id": "p3", "leader": "B"},
        {"kind": "paper_exit", "position_id": "p1", "realized_usd": 100.0},
        {"kind": "paper_exit", "position_id": "p2", "realized_usd": -40.0},
        {"kind": "live_exit", "position_id": "p3", "realized_usd": 10.0},
        {"kind": "paper_exit", "position_id": "unknown", "realized_usd": 999.0},  # no leader -> not scored
        {"kind": "paper_exit", "position_id": "p1", "realized_usd": None},        # junk -> ignored
    ]


class ScoreLeadersTest(unittest.TestCase):
    def test_ranks_and_aggregates(self):
        scores = score_leaders(_events())
        self.assertEqual(len(scores), 2)
        by = {s.leader_address: s for s in scores}
        self.assertEqual(by["A"].trades, 2)
        self.assertEqual(by["A"].wins, 1)
        self.assertEqual(by["A"].win_rate, 0.5)
        self.assertEqual(by["A"].total_realized_usd, 60.0)
        # A = 60 * (0.5 + 0.5*0.5) = 45 ; B = 10 * (0.5 + 0.5*1.0) = 10
        self.assertEqual(by["A"].score, 45.0)
        self.assertEqual(by["B"].score, 10.0)
        self.assertEqual(scores[0].leader_address, "A")  # ranked desc

    def test_ignores_unknown_and_junk(self):
        scores = score_leaders(_events())
        self.assertEqual(sum(s.trades for s in scores), 3)  # p1,p2,p3 only

    def test_empty(self):
        self.assertEqual(score_leaders([]), [])

    def test_partial_exits_count_as_one_trade(self):
        evs = [
            {"kind": "paper_entry", "position_id": "p1", "leader": "A"},
            {"kind": "paper_exit", "position_id": "p1", "realized_usd": 10.0},   # partial
            {"kind": "paper_exit", "position_id": "p1", "realized_usd": -4.0},   # partial (same pos)
            {"kind": "paper_exit", "position_id": "p1", "realized_usd": 6.0},    # partial (same pos)
        ]
        scores = score_leaders(evs)
        self.assertEqual(len(scores), 1)
        self.assertEqual(scores[0].trades, 1)                  # one position, not three exits
        self.assertEqual(scores[0].total_realized_usd, 12.0)   # 10 - 4 + 6 net
        self.assertEqual(scores[0].wins, 1)

    def test_nan_and_inf_realized_are_ignored(self):
        evs = [
            {"kind": "paper_entry", "position_id": "p1", "leader": "A"},
            {"kind": "paper_entry", "position_id": "p2", "leader": "A"},
            {"kind": "paper_exit", "position_id": "p1", "realized_usd": float("nan")},
            {"kind": "paper_exit", "position_id": "p2", "realized_usd": 50.0},
        ]
        scores = score_leaders(evs)
        self.assertEqual(len(scores), 1)
        self.assertEqual(scores[0].total_realized_usd, 50.0)   # NaN chunk dropped, not summed


class BacktestTest(unittest.TestCase):
    def test_equity_and_drawdown(self):
        res = run_backtest(_events())
        # realized exits with a number: +100, -40, +10, +999 (None ignored)
        self.assertEqual(res.exits, 4)
        self.assertEqual(res.total_realized_usd, 1069.0)
        self.assertEqual(res.max_drawdown_usd, 40.0)


if __name__ == "__main__":
    unittest.main()
