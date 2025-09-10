How I Implemented the Model (Plain‑English Essay)
=================================================

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
Think of it as a small checklist interpreted consistently every day:

1) Trend structure
   - If Price > SMA50 > SMA200: Uptrend. This favors Buy/Hold on pullbacks.
   - If Price < SMA50: Caution. This biases away from adding risk (Reduce if other signals agree).

2) RSI guards
   - RSI ≥ 80: Very hot. Recommendation leans Reduce (take risk off).
   - RSI ≥ 70 (and we were about to Buy): Do not buy fresh here → Hold instead.
   - RSI ≤ 30 AND trend still up: An oversold pullback within an uptrend can be buy‑the‑dip friendly (Buy), but we still use stop‑losses.

3) Macro overlays (light but important)
   - VIX regime: If “high”, we scale down risk and cap confidence to 55. Reason: choppy conditions make edges less reliable.
   - USD trend: If USD is in a sustained uptrend, we slightly reduce risk.

4) News overlay (conservative)
   - We read public RSS feeds (Google News + crypto). A very simple keyword heuristic marks headlines as Positive / Negative / Neutral. We then compute a bias (−1..+1) and intensity (0..1).
   - Effect: only small nudges to risk and confidence; if bias is significantly negative and intense, we lean away from a Buy. This overlay is bounded and cannot override safety rails.

5) Risk sizing and levels (using ATR)
   - ATR is our yardstick for “how much price wiggles on a typical day.”
   - Entry zone: around the current price within ±0.25 to ±0.5 ATR depending on action. We show a single number if the range collapses.
   - Stop‑loss: farther when volatility is high (multiple of ATR); closer when calm. This aims to avoid getting stopped by normal noise.
   - Take‑profit: also ATR‑scaled. The ratio between take and stop is wider for Buy than for Hold/Reduce.
   - Risk multiplier: macro/news regimes tighten or loosen these distances slightly (e.g., high VIX multiplies ATR by 0.6 for more conservative targets).

6) Confidence (0–100)
   - Starts at 60, then adjusts:
     - +10 if trend is clearly up (Price > 50 > 200)
     - −15 if VIX is high
     - −10 if RSI > 70; +5 if RSI < 35 and trend up
   - Finally, we clamp to [0, 100] and hard‑cap at 55 in high‑VIX regimes.

7) Safety rails (fail‑safe checks)
   - If the data looks stale (e.g., a holiday or an upstream hiccup), we force Hold and cap confidence.
   - If final confidence falls below a configured threshold (default 50), we suppress to Hold. This favors “first, do no harm.”

Why ATR matters (with examples)
-------------------------------
ATR ≈ typical daily range in dollars. If MSTR’s ATR is $15, daily wiggles of ~±$15 are common. Using ATR:
- Buy example: Price 300, ATR 15. A 1.75×ATR stop → 300 − 26.25 = 273.75. A 2.5×ATR take → 300 + 37.50 = 337.50. In a volatile tape we give the trade more room; in calm periods these distances shrink.
- Reduce example: If conditions are hot (overbought) or price is below the 50DMA, we suggest trimming with tighter stops and closer takes.

Explainability: “What changed” and narrative
--------------------------------------------
We compute a one‑liner narrative and track which inputs shifted (trend crosses, RSI band changes, VIX band flips, USD trend flips, correlation swings). This makes the daily call auditable and understandable.

Backtests and metrics
---------------------
We simulate the baseline logic on historical daily closes with a small slippage assumption:
- Summary metrics: total return, drawdown, volatility, Sharpe, turnover.
- Rolling metrics: 12‑month Sharpe, drawdown, and “hit‑rate” (fraction of up days), to show how stability changed over time.
- Monthly heatmap: a compact view of path dependence.

Weekly ML classifier (5‑day horizon)
------------------------------------
We label each day as Up / Flat / Down based on the next 5 trading days’ return, and train a calibrated classifier on daily features (MA/EMA, RSI, MACD, ATR, cross‑asset context). We publish the latest class probabilities. The combined call blends this with the baseline conservatively; it never overrides configured safety rails.

Daily next‑day close prediction (informational)
----------------------------------------------
A Gradient Boosting Regressor predicts tomorrow’s closing price using daily features. We validate with walk‑forward splits and keep a forward‑only log: today we publish a prediction for the next trading day; tomorrow we fill in the actual and compute $ and % errors. This is **not** used to set Buy/Hold/Reduce.

Live data and news
------------------
The hot feed updates near‑live price and news to keep the UI fresh without incurring intraday data costs. It does not modify the daily recommendation mid‑day. The sentiment overlay from news is applied at the daily run, and even then only as a bounded nudge.

Design choices and trade‑offs
-----------------------------
- Transparency first: rules you can read and explain beat opaque signals, especially for novice users.
- Safety first: confidence caps and minimum thresholds prefer inaction over low‑quality action.
- Free‑tier friendly: daily bars and a static site ensure reliability without recurring costs.
- ML as a helper, not a driver: small models add signal where helpful, but the baseline rules stay in charge.

Limitations & future ideas
--------------------------
- Intraday signals are intentionally out‑of‑scope to keep costs at zero; a “provisional intraday” path could be added as a clearly labeled preview.
- Broader macro/news understanding (LMMs, embeddings) can refine the overlay, still bounded by safety rails.
- Portfolio‑level sizing and Kelly‑style risk budgeting could be considered once multiple assets are covered.


