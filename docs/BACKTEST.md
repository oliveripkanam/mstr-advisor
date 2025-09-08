Backtester (Baseline)
=====================

Inputs
------
- `data/public/mstr_ohlcv.json` daily OHLCV (no look‑ahead)

Logic (baseline)
----------------
- Trend/momentum: long when `close > SMA50 > SMA200`, flat when `close < SMA50`
- RSI guards: avoid buys >70; force flat >80
- Execution: close/close (daily bar). Slippage/fees via bps per position change

Outputs
-------
- `data/public/backtest_baseline.json`: summary (days, total return, CAGR, vol, max drawdown, Sharpe, turnover, params + params_hash)
- `data/public/backtest_equity.json`: equity curve [{timestamp, equity}]
- `data/public/backtest_rolling.json`: rolling 12m Sharpe, drawdown series
- `data/public/backtest_monthly.json`: monthly returns by year for heatmap

Determinism
-----------
- Summary includes `params_hash` (MD5 of config). Given fixed inputs, reruns are deterministic

Assumptions
-----------
- Daily cadence, end‑of‑day signals, no intraday fills
- Slippage default 10 bps per change; zero fees in v1


