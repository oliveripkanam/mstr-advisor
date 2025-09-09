Learn & Explain — Guide
=======================

How the advisor works
---------------------
1) Fetch daily prices for MSTR and related markets (BTC, SPY, QQQ, VIX, USD, TNX).
2) Compute features like moving averages, RSI, ATR, correlations.
3) Apply simple rules: trend, RSI guards, macro overlays (VIX, USD).
4) Size risk with ATR and publish Buy/Hold/Reduce + entry/stop/take‑profit.
5) Backtest to show historical context (Sharpe, drawdown, hit‑rate).

Key terms (short)
-----------------
See the /learn page for interactive, plain‑English explanations and today’s states for:
Trend, 50/200DMA, RSI, MACD, ATR, Bollinger, VIX, USD (UUP), 10Y Yield (TNX), Correlation,
Drawdown, Sharpe, Hit‑rate, Slippage.

Reading today’s recommendation
------------------------------
- Action: Buy/Hold/Reduce — the direction of the call.
- Confidence: heuristic score (0–100), capped in high‑volatility regimes.
- Risk bounds: entry zone, stop, take‑profit sized by ATR.

Safety rails
------------
- Stale data gate (weekend aware).
- Minimum confidence gate (configurable), and high‑VIX confidence cap.

Backtests
---------
- Baseline trend/RSI logic on daily bars with slippage.
- Summary metrics (CAGR, Sharpe, drawdown) and rolling series for context.


