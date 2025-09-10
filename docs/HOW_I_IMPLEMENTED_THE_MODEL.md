How I Implemented the Model (Plain‑English Essay)
=================================================

[This content mirrors `docs/ALGORITHM_ESSAY.md` and is the canonical user‑facing essay.]

Who this is for
---------------
You do not need a finance background. This document explains every moving part of the advisor in clear, practical terms: what the signals mean, how we compute them, how they influence the daily recommendation, and why we chose this approach.

How the system works at a glance
--------------------------------
1) Every day after the market closes, we download the new daily bar for MSTR and a few context assets.
2) We compute straightforward technical metrics (moving averages, RSI, MACD, ATR, etc.) and some context signals (volatility, USD trend, correlations).
3) A transparent “baseline rule engine” converts those inputs into Buy / Hold / Reduce with a confidence number and risk levels (entry, stop, take‑profit).
4) We generate plain‑English explanations and track “what changed” since yesterday.
5) Separately, once a week, a small ML model provides probabilities for 5‑day outcomes (Up/Flat/Down). We combine that with the baseline conservatively.
6) A daily regression predicts tomorrow’s closing price; it’s informational only.
7) During the day, a lightweight “hot feed” shows near‑live price and news for user context, but it does not change the official daily call.

Data we use (terms 101)
------------------------
- Daily OHLCV: Each day’s candle has Open, High, Low, Close, and Volume. We use these only once per day to stay free‑tier friendly and reproducible.
- Moving Averages (SMA/EMA):
  - SMA50, SMA200 = the simple average of the last 50 or 200 closes. SMA50 moves faster; SMA200 is slower, “long‑term trend”.
  - EMA is like SMA but weights recent days a bit more. We compute both to supply the ML/prediction models; the rules primarily use SMA.
- RSI(14): A momentum gauge between 0 and 100. Rough intuition: above 70 = “stretched to the upside”; below 30 = “stretched to the downside”. We use it to avoid buying into extreme overbought conditions and to consider “buy‑the‑dip” when an uptrend is intact.
- MACD(12,26,9): The difference between fast and slow EMAs and a signal line. It summarizes momentum changes. We do not directly trade on MACD crossovers in the rules, but it feeds the ML/prediction models.
- ATR(14): Average True Range. It measures typical daily range (how far price tends to move). We use ATR to size risk: wider stops when the market is more volatile; tighter when calm.
- Bollinger Bands(20,2): A moving average ± 2 standard deviations. It’s a rough gauge of “how far is far.” We export them for completeness; they are not primary drivers in the baseline rules.
- VIX: A market volatility index. We convert VIX into regimes: low / medium / high. “High volatility” means we should be more conservative.
- UUP (USD index): A stronger USD tends to be a headwind to risk assets; we use a simple 20‑over‑60‑day trend check.
- Correlation vs BTC/SPY/QQQ: We compute rolling correlations to understand whether MSTR is moving with crypto or broad equity indexes. High correlation to BTC suggests sensitivity to crypto headlines and volatility.

How the baseline recommendation is made
--------------------------------------
1) Trend structure: Price > SMA50 > SMA200 favors Buy/Hold on pullbacks; Price < SMA50 biases to Reduce.
2) RSI guards: ≥80 → Reduce; ≥70 avoid fresh buys; ≤30 within uptrend → buy‑the‑dip friendly.
3) Macro overlays: VIX high caps confidence and reduces risk; USD uptrend reduces risk slightly.
4) News overlay: keyword sentiment nudges risk/confidence within strict bounds; cannot override rails.
5) Risk sizing: entry/stop/take are ATR‑scaled; risk multiplier applies regime/news adjustments.
6) Confidence: rule‑based, bounded, and capped during high VIX.
7) Safety rails: stale → Hold + cap; min confidence threshold → Hold.

Backtests and metrics
---------------------
Daily‑bar simulation with slippage; outputs summary, equity, rolling Sharpe/drawdown/hit‑rate, and monthly heatmap.

Weekly ML classifier (5‑day horizon)
------------------------------------
Labels from future 5‑day returns; calibrated classifier on daily features; conservative blend with baseline.

Daily next‑day close prediction (informational)
----------------------------------------------
Gradient Boosting Regressor on daily features; walk‑forward validation; forward‑only prediction log with $/% error once actuals arrive.

Live data and news
------------------
Hot price/news keep the UI fresh. The daily call updates after the close; intraday signals do not change the canonical artifacts.

Design choices and trade‑offs
-----------------------------
Transparency, safety, free‑tier reliability, ML as helper, not driver.


