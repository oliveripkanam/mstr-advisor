MSTR Advisor (Free-First)
=========================

Daily, automated, beginner-friendly advisory for MSTR using free data and static hosting.

What it does
------------
- Pulls daily prices for MSTR and context assets via yfinance
- Validates and normalizes data
- Publishes small JSON artifacts consumed by a static site
- Runs automatically every day at 22:05 UTC (after US close)

Where things live
-----------------
- Raw daily data: `data/raw/*.json` (one file per symbol)
- Public frontend data: `data/public/` (e.g., `mstr_ohlcv.json`, `status.json`)
- Workflows: `.github/workflows/*.yml`
- Code: `backend/app/*.py`

Daily artifacts
---------------
- `data/public/mstr_ohlcv.json` → array of { timestamp, open, high, low, close, volume }
- `data/public/status.json` → summary of last run, per-symbol counts/latest dates, and staleness

How it runs
-----------
- GitHub Actions → Daily EOD Pipeline (scheduled 22:05 UTC) executes:
  1) Ingest raw data → `backend/app/ingest_prices.py`
  2) Normalize MSTR → `backend/app/normalize_mstr.py`
  3) Build status → `backend/app/build_status.py`
  4) Commit artifacts back to the repo
- Manual check: Smoke Status workflow runs only the status builder and prints JSON

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

See `BUILD_PLAN.md` for the full schedule.


