Progress Log (Detailed)
=======================


This file captures exactly what was implemented each day/part, including files touched, outputs produced, and verification steps.


Day 1
----------------------------------
- Part 1: Repo public + GitHub Pages
  - Enabled GitHub Pages (source: GitHub Actions) for static hosting.
  - Created base folders: `data/public`, `configs`, `frontend`, `backend`, `infra`, `notebooks`.
  - Added root `.env.example` with `TZ`, `RUN_TIME_UTC`, `MAX_RETRIES`.


- Part 2: Scheduled daily workflow
  - Added `.github/workflows/daily.yml` with cron at 22:05 UTC and manual dispatch.
  - Python 3.11 + pip cache; placeholder write of `status.json`.


- Part 3: Ingestion of raw prices
  - Added `requirements.txt` (pandas, yfinance, numpy).
  - Implemented `backend/app/ingest_prices.py` to download daily OHLCV for: `MSTR, BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX` since 2018.
  - Outputs JSON to `data/raw/{SYMBOL}.json` (e.g., `MSTR.json`, `_VIX.json`).
  - Fixes: handle Series truthiness, duplicate columns, and MultiIndex columns from yfinance.


- Part 4: Normalization for MSTR
  - Added `backend/app/normalize_mstr.py` to read `data/raw/MSTR.json`, validate/sort/drop future dates, ensure required columns.
  - Writes `data/public/mstr_ohlcv.json` with `[timestamp, open, high, low, close, volume]`.
  - Wired normalize step into workflow.


- Part 5: Enhanced status
  - Added `backend/app/build_status.py` to summarize per‑symbol counts/latest dates and public MSTR summary.
  - Status includes `last_run_utc`, `symbols{...}`, `public.mstr_ohlcv{...}`, `stale`.


- Part 6: Reliability + smoke test
  - Ingestion now uses env‑driven retries with exponential backoff + jitter.
  - `status.json` staleness ignores weekends (not marked stale when markets are closed).
  - Added `.github/workflows/smoke.yml` to run status builder without commits.

- Part 7: Documentation
  - Added `README.md` with overview, paths, quickstart, workflows.
  - Added `docs/INGEST.md` with schemas, pipeline steps, and troubleshooting.

Day 2
-----------------------------------
- Part 1: Technical indicators (MSTR)
  - Implemented `backend/app/features_mstr.py` to compute indicators from `mstr_ohlcv.json`:
    - SMA(10/20/50/200), EMA(10/20/50/200), RSI(14), MACD(12,26,9), ATR(14), Bollinger(20,2)
  - Outputs `data/public/mstr_technical.json`.
  - Wired into the daily workflow after status.
  
  Verification
  - Ran the daily workflow; confirmed `data/public/mstr_technical.json` exists with recent rows.


- Part 2: Cross-asset features and regimes
  - Implemented `backend/app/crossasset_mstr.py` to build cross-asset features:
    - 20/60-day rolling correlations of MSTR returns vs BTC-USD, SPY, QQQ
    - Regime flags: VIX bands (low/med/high), UUP 20v60 trend flag, TNX 5d delta
  - Inputs: `data/public/mstr_ohlcv.json` and raw files under `data/raw/` (BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX)
  - Output: `data/public/mstr_crossasset.json`
  - Wired into daily workflow after technical features.


- Part 3: Baseline rule engine
  - Implemented `backend/app/baseline_rules.py` to produce a daily recommendation:
    - Rules: trend (close>50DMA>200DMA), RSI guards (>70 avoid buys; >80 reduce; <30 add if trend up), macro overlays (VIX band, UUP trend)
    - Risk: ATR(14)-based entry zone, stop, take-profit; simple confidence heuristic
  - Inputs: `mstr_technical.json` and `mstr_crossasset.json`
  - Output: `data/public/baseline_signal.json` (action, entry_zone, stop, take_profit, confidence, why, inputs)
  - Wired into daily workflow after cross-asset features.

- Part 4: Publish latest recommendation
  - Implemented `backend/app/publish_recommendation.py` to convert `baseline_signal.json` into a lighter `latest_recommendation.json` for the frontend.
  - Fields: symbol, timestamp, action, entry_zone, stop, take_profit, confidence, why
  - Wired into workflow after baseline generation.

- Part 5: "What changed" summary
  - Implemented `backend/app/what_changed_mstr.py` to compare last two common dates across tech and cross-asset features.
  - Detects: price vs 50DMA crossover, 50/200DMA cross, RSI band shifts, VIX regime change, USD trend flip, and large corr(20d) moves.
  - Output: `data/public/what_changed.json` with items, deltas, and a short summary.
  - Wired into daily workflow after publishing latest recommendation.

- Part 6: Safety rails v1
  - Enhanced `baseline_rules.py` to apply gating:
    - Stale data (from `status.json`) → downgrade to Hold and cap confidence
    - Minimum confidence (env `MIN_CONFIDENCE`, default 50) → Hold and mark suppressed
  - Output now includes `suppressed` boolean and appended notes in `why` when gating triggers.


Day 3
-----------------------------------
- Part 1: Next.js scaffold
  - Added frontend app with Next.js 14 + Tailwind, static export enabled.
  - Files: `frontend/package.json`, `frontend/next.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/globals.css`.

- Part 2: Price chart
  - Added `frontend/components/PriceChart.tsx` using `lightweight-charts` and wired it to `/data/public/mstr_ohlcv.json`.
  - Rendered the chart on the homepage (`app/page.tsx`).

- Part 3: Recommendation card
  - Added `frontend/components/RecommendationCard.tsx` that reads `/data/public/latest_recommendation.json` and displays action, entry/stop/TP, confidence, and why.
  - Wired into the homepage below the chart.

- Part 4: Explainer view
  - Added `frontend/app/explainer/page.tsx` that reads `/data/public/what_changed.json` and `/data/public/baseline_signal.json` and shows changes + rationale.
  - Linked from homepage.

- Part 5: Glossary tooltips
  - Added `configs/glossary.yaml` with beginner-friendly definitions for terms (RSI, SMA/EMA, MACD, ATR, Bollinger, VIX, etc.).
  - Added `frontend/components/GlossaryTooltip.tsx` to fetch and render tooltip titles from the YAML.

- Part 6: Mobile/a11y polish
  - Improved contrast and focus styles; added responsive padding; accessible link focus ring.
  - Tweaked Tailwind palette to darker primary/accent for better contrast.

- Part 7: Static export & Pages deploy
  - Added `.github/workflows/pages.yml` to build `frontend/` (static export) and deploy `frontend/out` to GitHub Pages.
  - Copies `data/public/*.json` and `configs/glossary.yaml` into `frontend/public/` during build for the static site.

Day 4
-----------------------------------
- Part 1: Baseline backtester (daily bars)
  - Added `backend/app/backtest_baseline.py` to simulate a simple trend/RSI baseline on daily closes with slippage.
  - Produces `data/public/backtest_baseline.json` (summary metrics) and `data/public/backtest_equity.json` (equity curve).
  - Wired into the daily workflow so artifacts update automatically.

- Part 2: Backtests page
  - Added `frontend/app/backtests/page.tsx` to render summary metrics and an equity curve from backtest JSONs.
  - Linked from homepage.

- Part 3: Rolling metrics
  - Enhanced backtester to export rolling 12m Sharpe and drawdown to `data/public/backtest_rolling.json`.
  - Updated Backtests page to render Rolling Sharpe and Drawdown below the equity curve.

- Part 4: Determinism marker
  - Added `params_hash` (MD5) to backtest summary for reproducibility tracking.

- Part 5: Monthly returns heatmap
  - Enhanced backtester to export monthly returns as `data/public/backtest_monthly.json`.
  - Backtests page renders a simple monthly heatmap table.

- Part 6: Backtest smoke workflow
  - Added `.github/workflows/backtest-smoke.yml` to run the backtest on demand and upload artifacts.

- Part 7: Backtests page polish
  - Added params hash display and link to `docs/BACKTEST.md`; minor formatting.

Documentation
-------------
- Added `docs/BACKTEST.md` describing inputs, logic, outputs, and determinism.

Day 5
-----------------------------------
- Part 1: Baseline explainer (narrative + drivers)
  - Added `backend/app/explain_baseline.py` to generate `data/public/explain_latest.json` with a plain-English narrative and top drivers (trend, RSI, VIX band, USD trend, correlations, ATR).
  - Wired into the daily workflow after publishing latest recommendation.

- Part 2: Explainer UI wiring
  - Updated Explainer page to load `explain_latest.json` and show narrative + drivers with glossary tooltips.

- Part 3: Tone/length polish
  - Trim narrative to ~160 chars and cap driver list to 5 unique items.

- Part 4: Payload audit
  - Status builder now reports per-file sizes and total JSON payload with a budget flag.

- Part 5: Edge-case safeguards
  - RecommendationCard caches last good `latest_recommendation.json` in localStorage for offline/404.
  - Explainer uses `aria-live` for assistive tech updates.

- Part 6: Copy tone refinement
  - Narrative now starts with “Today: Action (Confidence X%).” and then rationale.

- Part 7: Suppression note
  - If a recommendation is suppressed (stale/low confidence), the narrative appends a short note.

Day 6
-----------------------------------
- Part 1: Labels (5d horizon)
  - Added `backend/app/labels_mstr.py` to compute future 5d returns and 3-class labels (Up/Flat/Down), saved to `data/public/labels_mstr_5d.json`.
  - Wired into daily workflow for freshness.

- Part 2: Model scaffold + latest probabilities
  - Added `backend/app/train_ml_mstr.py` to assemble features/labels, train a calibrated classifier, and emit `data/public/ml_latest_probs.json` and `ml_model_meta.json`.
  - Wired into the daily workflow (lightweight runtime, free tier friendly).
  
- Part 2.1: Frontend probabilities badge
  - RecommendationCard now displays latest ML (5d) class probabilities (if available).

- Part 3: Combine baseline + ML (safety rails)
  - Added `backend/app/combine_baseline_ml.py` to blend confidence and conservatively adjust action when ML is strong; respects suppression.
  - Emits `data/public/latest_recommendation_combined.json`.
  - Wired into daily workflow.

- Part 4: Feature importances (lightweight)
  - `train_ml_mstr.py` now writes `data/public/ml_feature_importances.json` (top features) for explainability.

- Part 5: Frontend ML toggle and visualization
  - Added `configs/frontend.json` to toggle using `latest_recommendation_combined.json` and probability bars.
  - Created `frontend/components/ProbabilityBars.tsx` to render Up/Flat/Down bars.
  - Enhanced `frontend/components/RecommendationCard.tsx` to optionally read combined recommendation, show a "Combined" pill, and display probability bars based on config.

- Part 6: Runtime budget & scheduling
  - Edited `/.github/workflows/daily.yml` to focus daily runs on baseline pipeline only.
  - Added `/.github/workflows/ml-weekly.yml` to run labels + ML + combine weekly (Monday 22:15 UTC) with commit of ML artifacts.

Day 7
-----------------------------------
- Part 1: Volatility and BTC-correlation regimes
  - Added `backend/app/regimes_mstr.py` to classify VIX regime (low/med/high) and 60d BTC correlation (neg/neutral/pos). Writes `data/public/regimes_mstr.json`.

- Part 3: Risk caps refinement
  - `baseline_rules.py` now caps confidence at 55 during high VIX regime.

- Part 4: Rolling hit-rate series
  - Backtester now outputs `hit_rate_252` in `backtest_rolling.json` (fraction of positive days over ~12m).
  - Backtests page renders the series when present.

- Part 5: Data Status page
  - Added `frontend/app/status/page.tsx` to display `status.json` (last run, staleness, payload sizes, raw symbol freshness) and linked it from Home.

- Part 6: CI integration checks
  - Added `/.github/workflows/integration.yml` to validate JSON artifacts and run a frontend build dry-run on pushes and PRs.

- Part 2: Optional change-point regimes
  - Added `backend/app/change_points.py` (CUSUM-based) and wired into daily workflow (non-fatal). Outputs `data/public/change_points_mstr.json`.
  - Added `/.github/workflows/acceptance.yml` for on-demand acceptance backtests with a simple metric gate and optional tag.

Fixes and Finalization
----------------------
- Fixed `backend/app/crossasset_mstr.py` import typo (`numpy as np`).
- Pages deploy now copies `configs/frontend.json` and `docs/BACKTEST.md`; Backtests links to `BACKTEST.md`.
- Data Status page fetch path corrected to `data/public/status.json`.
- Added `docs/ML.md` and `ml-regression.yml` (frozen-window ML sanity checks).
 - Status page visuals: added payload ring chart and per-file size meters.

Learn & Explain
---------------
- Added `frontend/app/learn/page.tsx` with interactive terminology chips and side panels.
- Added `configs/terminology.json` with plain‑English definitions and impacts.
- Linked `Learn` from Home; added `docs/LEARN_GUIDE.md` describing site flow and terms.


Day 8
-------------------------------------
- Part 1: Hot data generator
  - Added `backend/app/hot_data.py` to emit `data/public/hot.json` with fields: `{ timestamp/asof_utc, symbol, last_price, prev_close, change_pct, market_open }`.
  - Designed to be lightweight and idempotent; replaces NaN with null for valid JSON.

- Part 2: Hot data workflow (decoupled from site builds)
  - Added `.github/workflows/hot-data.yml` running every 10 minutes on weekdays (and manual `workflow_dispatch`).
  - Checks out the `hotdata` branch, runs `hot_data.py`, commits only when values change, and pushes.
  - Uses concurrency group `hot-data`; commit message tagged `[skip ci]` to avoid triggering other workflows.

- Part 3: Frontend live wiring
  - New `frontend/components/HotPreview.tsx`: blue banner that shows the latest intraday price and percent, polling every 90s and pausing when the tab is hidden. Handles both `asof_utc` and `timestamp`, and computes percent from either `change_pct` or `(last_price, prev_close)`.
  - Home KPIs (`frontend/app/page.tsx` → `KpiBar`): prefers live `hot.json` for Price and Day change and labels them “(Live)”; recomputes vs‑50DMA using SMA50 from technicals; polls every 90s.
  - Chart (`frontend/components/PriceChart.tsx`): overlays a blue “Live” price line sourced from `hot.json`, refreshed every 90s. Range controls, volume pane, crosshair retained.


- Part 4: Pages deploy and integration
  - Frontend changes land on `main` and are deployed by `pages.yml` as usual. The live UI then reads `hot.json` directly from `raw.githubusercontent.com` without a site rebuild.
  - Integration workflow continues to validate JSON and build preview; no changes required.


- Part 5: Housekeeping and fixes
  - Ensured cross‑asset JSON wrote valid `null` instead of `NaN`.
  - Ensured Backtests doc link uses the correct Pages path; copied docs/configs in deploy workflow to avoid 404s.
  - Added payload budget meters and ring chart on Status page.


Day 9
-------------------------------------
- Part 1: Retired Explainer (redirected `/explainer`→`/info`), removed link on Home, and added a collapsible details drawer (narrative, drivers, what changed) inside `frontend/components/RecommendationCard.tsx`.


