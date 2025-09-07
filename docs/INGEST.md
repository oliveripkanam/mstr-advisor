Ingestion & Artifacts
=====================

Overview
--------
The daily job pulls end-of-day prices from yfinance and writes:
- Raw per-symbol JSON: `data/raw/{SYMBOL}.json`
- Public MSTR file: `data/public/mstr_ohlcv.json`
- Status summary: `data/public/status.json`

Schemas
-------
Raw per-symbol JSON (array of objects):
```
{
  "timestamp": "YYYY-MM-DD",
  "symbol": "MSTR",
  "open": 123.45,
  "high": 130.00,
  "low": 120.10,
  "close": 125.67,
  "volume": 1234567,
  "source": "yfinance",
  "ingested_at": "YYYY-MM-DDTHH:MM:SSZ"
}
```

Public MSTR JSON (array of objects):
```
{
  "timestamp": "YYYY-MM-DD",
  "open": 123.45,
  "high": 130.00,
  "low": 120.10,
  "close": 125.67,
  "volume": 1234567
}
```

Status JSON:
```
{
  "last_run_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "symbols": {
    "MSTR": { "exists": true, "rows": 1900, "latest": "YYYY-MM-DD" },
    "BTC-USD": { "exists": true, "rows": 2700, "latest": "YYYY-MM-DD" }
  },
  "public": {
    "mstr_ohlcv": { "exists": true, "rows": 1900, "latest": "YYYY-MM-DD" }
  },
  "stale": false
}
```

Pipelines
---------
1) `backend/app/ingest_prices.py` → writes `data/raw/*.json`
2) `backend/app/normalize_mstr.py` → writes `data/public/mstr_ohlcv.json`
3) `backend/app/build_status.py` → writes `data/public/status.json`

Operational notes
-----------------
- Schedule: 22:05 UTC daily (after US close)
- Retries: exponential backoff with jitter; `MAX_RETRIES` env controls attempts
- Weekends: `stale` is suppressed (markets closed)

Troubleshooting
---------------
- Empty or missing raw files: rerun the daily job; check API rate limits.
- Non-monotonic timestamps: normalization drops duplicates and sorts.
- JSON too large: This is expected over years of data; the frontend should stream or paginate.


