Progress Log (Detailed)
=======================

This file captures exactly what was implemented each day/part, including files touched, outputs produced, and verification steps.

Day 1 — Repo, CI, Data Ingest MVP
----------------------------------
- Part 1: Repo public + GitHub Pages
  - Enabled GitHub Pages (source: GitHub Actions) for static hosting.
  - Created base folders: `data/public`, `configs`, `frontend`, `backend`, `infra`, `notebooks`.
  - Added root `.env.example` with `TZ`, `RUN_TIME_UTC`, `MAX_RETRIES`.
  - Commit title: docs: add free‑first build plan (starting Sep 7, 2025)

- Part 2: Scheduled daily workflow
  - Added `.github/workflows/daily.yml` with cron at 22:05 UTC and manual dispatch.
  - Python 3.11 + pip cache; placeholder write of `status.json`.
  - Commit title: ci: add daily scheduled workflow (22:05 UTC) writing status.json

- Part 3: Ingestion of raw prices
  - Added `requirements.txt` (pandas, yfinance, numpy).
  - Implemented `backend/app/ingest_prices.py` to download daily OHLCV for: `MSTR, BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX` since 2018.
  - Outputs JSON to `data/raw/{SYMBOL}.json` (e.g., `MSTR.json`, `_VIX.json`).
  - Fixes: handle Series truthiness, duplicate columns, and MultiIndex columns from yfinance.
  - Commit titles:
    - fix: resolve pandas Series truthiness error in ingestion
    - fix: handle duplicate column names from yfinance before numeric coercion
    - fix: flatten MultiIndex columns from yfinance before standardization

- Part 4: Normalization for MSTR
  - Added `backend/app/normalize_mstr.py` to read `data/raw/MSTR.json`, validate/sort/drop future dates, ensure required columns.
  - Writes `data/public/mstr_ohlcv.json` with `[timestamp, open, high, low, close, volume]`.
  - Wired normalize step into workflow.
  - Commit title: feat: add MSTR normalizer and wire into daily workflow

- Part 5: Enhanced status
  - Added `backend/app/build_status.py` to summarize per‑symbol counts/latest dates and public MSTR summary.
  - Status includes `last_run_utc`, `symbols{...}`, `public.mstr_ohlcv{...}`, `stale`.
  - Commit title: feat: add enhanced status builder and wire into workflow

- Part 6: Reliability + smoke test
  - Ingestion now uses env‑driven retries with exponential backoff + jitter.
  - `status.json` staleness ignores weekends (not marked stale when markets are closed).
  - Added `.github/workflows/smoke.yml` to run status builder without commits.
  - Commit title: feat: refine staleness logic, add ingest backoff, and add smoke workflow

- Part 7: Documentation
  - Added `README.md` with overview, paths, quickstart, workflows.
  - Added `docs/INGEST.md` with schemas, pipeline steps, and troubleshooting.
  - Commit title: docs: add README and ingestion docs

Day 2 — Features and Baseline Rules
-----------------------------------
- Part 1: Technical indicators (MSTR)
  - Implemented `backend/app/features_mstr.py` to compute indicators from `mstr_ohlcv.json`:
    - SMA(10/20/50/200), EMA(10/20/50/200), RSI(14), MACD(12,26,9), ATR(14), Bollinger(20,2)
  - Outputs `data/public/mstr_technical.json`.
  - Wired into the daily workflow after status.
  - Commit title: feat: add MSTR technical indicators and wire into daily job

  Verification
  - Ran the daily workflow; confirmed `data/public/mstr_technical.json` exists with recent rows.

- Part 2: Cross-asset features and regimes
  - Implemented `backend/app/crossasset_mstr.py` to build cross-asset features:
    - 20/60-day rolling correlations of MSTR returns vs BTC-USD, SPY, QQQ
    - Regime flags: VIX bands (low/med/high), UUP 20v60 trend flag, TNX 5d delta
  - Inputs: `data/public/mstr_ohlcv.json` and raw files under `data/raw/` (BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX)
  - Output: `data/public/mstr_crossasset.json`
  - Wired into daily workflow after technical features.
  - Commit title: feat: add cross-asset correlations and simple regime flags
  - Commit description: Compute corr(20/60) with BTC/SPY/QQQ; add VIX band, UUP trend, TNX delta; output mstr_crossasset.json and update workflow.

- Part 3: Baseline rule engine
  - Implemented `backend/app/baseline_rules.py` to produce a daily recommendation:
    - Rules: trend (close>50DMA>200DMA), RSI guards (>70 avoid buys; >80 reduce; <30 add if trend up), macro overlays (VIX band, UUP trend)
    - Risk: ATR(14)-based entry zone, stop, take-profit; simple confidence heuristic
  - Inputs: `mstr_technical.json` and `mstr_crossasset.json`
  - Output: `data/public/baseline_signal.json` (action, entry_zone, stop, take_profit, confidence, why, inputs)
  - Wired into daily workflow after cross-asset features.
  - Commit title: feat: add baseline rule engine and daily recommendation JSON
  - Commit description: Generate Buy/Hold/Reduce with ATR-based risk and macro overlays; write baseline_signal.json and update workflow.


