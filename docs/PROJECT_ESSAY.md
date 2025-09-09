## A Free‑First Advisor for MSTR (Concise Write‑Up)

This app gives a daily Buy, Hold, or Reduce view on MicroStrategy (MSTR) with a confidence score and a short explanation. It ingests public market data, computes common indicators (moving averages, RSI, ATR, MACD, Bollinger Bands), and adds cross‑asset context like VIX regime, USD trend (UUP), and 20‑day BTC correlation. Everything is produced as JSON and rendered on a static Next.js site so it’s free to use and easy to audit.

The baseline engine is rule‑based and conservative. Trend structure (price vs. 50/200‑day averages) is the anchor; RSI adds momentum context; ATR informs expected range. During high‑volatility VIX regimes, confidence is capped to avoid overstatement. If data is stale, the system holds back. The output is a clear action, a confidence bar, and a ranked list of drivers.

There’s an optional ML layer trained weekly: a calibrated Gradient Boosting model on the same features with 5‑day forward‑return labels (Up/Flat/Down). Its probabilities pass sanity checks and blend cautiously with the baseline. ML never overrides guardrails and remains budget‑friendly by running on a schedule, not daily.

Backtesting validates the basic behavior: I track CAGR, max drawdown, Sharpe, turnover, rolling hit‑rate, and a monthly returns heatmap. CI gates assert metric sanity to catch regressions early. The chart uses Lightweight‑Charts with clean scaling, URL‑synced ranges, and a volume pane. The Info page explains each term in plain English with “Today” values and simple guidance.

I built this with Python (pandas, yfinance, scikit‑learn) and Next.js 14. GitHub Actions handle daily data, weekly ML, integration checks, and static deploys. Key engineering lessons: fix NaN→null before JSON; respect GitHub Pages basePath; keep workflows tidy; prioritize explainability over complexity. It’s not financial advice—it’s a disciplined daily brief you can verify yourself.


