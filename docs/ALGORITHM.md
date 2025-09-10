Algorithm Deep‑Dive
===================

Purpose
-------
Explain how the advisor computes daily recommendations, how ML and prediction fit in, and how news and live data are used.

Cadence
-------
- Daily (22:05 UTC): ingest, features, cross‑asset, baseline rules, explainability, backtests, prediction, status.
- Weekly (Mon 22:15 UTC): labels + ML classifier + combined recommendation.
- Hot (10m / 30m): live price (`hot.json`) and news (`news.json`/`news_score.json`) on hotdata branch.

Baseline rules (deterministic)
------------------------------
Inputs: latest row from `mstr_technical.json` and `mstr_crossasset.json`.
- Trend: price > 50DMA > 200DMA supports Buy/Hold on dips.
- Below 50DMA biases to Reduce.
- RSI guards: ≥80 → Reduce; ≥70 → avoid new buys; ≤30 within uptrend → buy‑the‑dip friendly.
- Macro overlays: VIX band (high reduces risk and caps confidence), UUP uptrend (mild headwind).
- News overlay: conservative keyword sentiment (bias −1..1, intensity 0..1) lightly nudges risk/confidence within bounds; does not override safety rails.
- Sizing: ATR(14) sets entry zone, stop, take‑profit per action; confidence derives from rule strength with caps.
- Safety rails: stale data → Hold + cap; minimum confidence threshold.

Explainability
--------------
Narrative and “what changed” compare day‑over‑day signal flips (trend, RSI bands, VIX, USD, correlations) with a concise rationale.

Backtests
---------
Daily‑bar simulation of baseline, with slippage. Outputs summary, equity curve, rolling Sharpe/drawdown/hit‑rate, and monthly heatmap.

ML 5‑day classifier (weekly)
----------------------------
Labels: future 5‑day return sign (Up/Flat/Down). Model: calibrated classifier on daily features. Produces latest class probabilities and feature importances. Combined recommendation blends ML with baseline conservatively and respects suppression.

Next‑day close prediction (daily)
---------------------------------
Gradient Boosting Regressor on daily features (price/volume, MA/EMA, RSI, MACD, ATR). Walk‑forward validation; train‑on‑all for the latest forecast. Forward‑only log: we write the next trading day `pred`, then fill `actual` and $/% errors after the subsequent EOD.

Live data usage
---------------
`hot.json` powers UI (banner, KPIs, live line). It does not alter canonical daily artifacts. News feeds update intraday; the sentiment overlay is applied during the daily run.

Why this approach
-----------------
Free‑tier friendly (static hosting), reproducible daily snapshots, transparent rules with light ML assistance, and simple live context without incurring intraday data/storage costs.


