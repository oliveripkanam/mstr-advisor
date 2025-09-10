MSTR Advisor
=========================
<img width="752" height="659" alt="demoscreenshot" src="https://github.com/user-attachments/assets/f2db8812-c189-4138-bf0b-7501df17196f" />

Daily, automated, beginner-friendly advisory for MSTR using free data and static hosting.

What it does
------------
- Pulls daily prices for MSTR and context assets via yfinance
- Validates and normalizes data
- Publishes small JSON artifacts consumed by a static site
- Runs automatically every day at 22:05 UTC (after US close)

Where things live
-----------------
- Raw daily data: `data/raw/*.json`
- Public frontend data: `data/public/*.json`
- Workflows: `.github/workflows/*.yml`
- Code: `backend/app/*.py`

Key artifacts
-------------
- `mstr_ohlcv.json`: { timestamp, open, high, low, close, volume }
- `mstr_technical.json`: SMA/EMA/RSI/MACD/ATR/Bollinger
- `mstr_crossasset.json`: correlations, VIX band, USD trend, TNX delta
- `baseline_signal.json` and `latest_recommendation.json`
- `explain_latest.json`, `what_changed.json`
- `backtest_*.json` (summary, equity, rolling, monthly)
- `regimes_mstr.json`, `change_points_mstr.json`
- `ml_latest_probs.json`, `ml_feature_importances.json`, `latest_recommendation_combined.json`
- `close_predictions.json` (append‑only next‑day close predictions)
- `news.json`, `news_score.json` (real‑world events and a simple sentiment signal)

How it runs
-----------
- Daily EOD (22:05 UTC): full baseline pipeline and artifacts.
- Weekly ML (Mon 22:15 UTC): labels + ML + combined recommendation.
- Hot Data (every 10m on weekdays → `hotdata` branch): `hot.json`.
- Hot News (every 30m during US market hours → `hotdata`): `news.json`, `news_score.json`.

Near‑live
---------
- The frontend reads near‑live JSONs from `raw.githubusercontent.com` (hotdata branch) and polls ~90s.

News sentiment
--------------
- Real‑world events come from RSS feeds. A conservative keyword heuristic assigns sentiment (Positive/Negative/Neutral). Many headlines are Neutral if they lack strong cues. This signal only nudges risk and does not influence model training. See the Info page for details.

Local quickstart
----------------
```
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python backend/app/ingest_prices.py
python backend/app/normalize_mstr.py
python backend/app/build_status.py
```

Troubleshooting
---------------
- Weekends: equities don’t trade; staleness is suppressed on weekends.
- API hiccups: ingestion retries with exponential backoff; rerun later if needed.
- Missing blue “Live preview” banner: ensure `hot-data` workflow is enabled and `hotdata` branch exists. Hard refresh the site after a deploy.

Config
------
- `MAX_RETRIES` (env): retry attempts for ingestion (default 3)
- `MIN_CONFIDENCE` (env): minimum confidence to avoid suppression (default 50)


