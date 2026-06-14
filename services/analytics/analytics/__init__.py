"""Soltrade offline analytics sidecar (leader scoring, backtesting, PnL).

Read-only and OFF the hot path: never imported by the trading runtime, never blocks a
trade. Advises the control plane via published scores; the control plane stays authoritative.
"""

__version__ = "0.1.0"
