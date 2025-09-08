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

- Part 4: Publish latest recommendation
  - Implemented `backend/app/publish_recommendation.py` to convert `baseline_signal.json` into a lighter `latest_recommendation.json` for the frontend.
  - Fields: symbol, timestamp, action, entry_zone, stop, take_profit, confidence, why
  - Wired into workflow after baseline generation.
  - Commit title: feat: publish latest_recommendation.json for frontend consumption
  - Commit description: Output minimal recommendation JSON derived from baseline signal and add workflow step.

- Part 5: "What changed" summary
  - Implemented `backend/app/what_changed_mstr.py` to compare last two common dates across tech and cross-asset features.
  - Detects: price vs 50DMA crossover, 50/200DMA cross, RSI band shifts, VIX regime change, USD trend flip, and large corr(20d) moves.
  - Output: `data/public/what_changed.json` with items, deltas, and a short summary.
  - Wired into daily workflow after publishing latest recommendation.
  - Commit title: feat: add daily 'What changed' summary JSON
  - Commit description: Generate concise change log for last two days and publish what_changed.json.

- Part 6: Safety rails v1
  - Enhanced `baseline_rules.py` to apply gating:
    - Stale data (from `status.json`) → downgrade to Hold and cap confidence
    - Minimum confidence (env `MIN_CONFIDENCE`, default 50) → Hold and mark suppressed
  - Output now includes `suppressed` boolean and appended notes in `why` when gating triggers.
  - Commit title: feat: add safety rails to baseline recommendation (stale/confidence gating)
  - Commit description: Use status.json staleness and env MIN_CONFIDENCE to suppress low-trust calls.


Day 3 — Frontend MVP (Static)
-----------------------------------
- Part 1: Next.js scaffold
  - Added frontend app with Next.js 14 + Tailwind, static export enabled.
  - Files: `frontend/package.json`, `frontend/next.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/globals.css`.
  - Commit title: feat: scaffold Next.js + Tailwind frontend (static export)
  - Commit description: Initialize frontend with base layout and palette; prepare for data wiring.

- Part 2: Price chart
  - Added `frontend/components/PriceChart.tsx` using `lightweight-charts` and wired it to `/data/public/mstr_ohlcv.json`.
  - Rendered the chart on the homepage (`app/page.tsx`).
  - Commit title: feat: add MSTR price chart wired to public JSON
  - Commit description: Install lightweight-charts and render a responsive candlestick chart.

- Part 3: Recommendation card
  - Added `frontend/components/RecommendationCard.tsx` that reads `/data/public/latest_recommendation.json` and displays action, entry/stop/TP, confidence, and why.
  - Wired into the homepage below the chart.
  - Commit title: feat: add RecommendationCard and wire to latest_recommendation.json
  - Commit description: Fetch minimal recommendation JSON and display in a styled card.

- Part 4: Explainer view
  - Added `frontend/app/explainer/page.tsx` that reads `/data/public/what_changed.json` and `/data/public/baseline_signal.json` and shows changes + rationale.
  - Linked from homepage.
  - Commit title: feat: add Explainer page and link from home
  - Commit description: Render What Changed items and baseline rationale in a simple explainer view.

- Part 5: Glossary tooltips
  - Added `configs/glossary.yaml` with beginner-friendly definitions for terms (RSI, SMA/EMA, MACD, ATR, Bollinger, VIX, etc.).
  - Added `frontend/components/GlossaryTooltip.tsx` to fetch and render tooltip titles from the YAML.
  - Commit title: feat: add glossary YAML and tooltip component
  - Commit description: Provide inline explanations for terms via a lightweight client tooltip.

- Part 6: Mobile/a11y polish
  - Improved contrast and focus styles; added responsive padding; accessible link focus ring.
  - Tweaked Tailwind palette to darker primary/accent for better contrast.
  - Commit title: chore: mobile responsiveness and accessibility polish
  - Commit description: Adjust colors, spacing, and focus states for better readability and keyboard nav.

- Part 7: Static export & Pages deploy
  - Added `.github/workflows/pages.yml` to build `frontend/` (static export) and deploy `frontend/out` to GitHub Pages.
  - Copies `data/public/*.json` and `configs/glossary.yaml` into `frontend/public/` during build for the static site.
  - Commit title: ci: add GitHub Pages deploy for frontend static site
  - Commit description: Build Next.js static export, stage artifacts, and deploy via GitHub Pages.

Day 4 — Backtesting Basics
-----------------------------------
- Part 1: Baseline backtester (daily bars)
  - Added `backend/app/backtest_baseline.py` to simulate a simple trend/RSI baseline on daily closes with slippage.
  - Produces `data/public/backtest_baseline.json` (summary metrics) and `data/public/backtest_equity.json` (equity curve).
  - Wired into the daily workflow so artifacts update automatically.
  - Commit title: feat: add baseline backtester and publish summary/equity JSON
  - Commit description: Compute CAGR, MDD, Sharpe, turnover and equity curve for baseline.
 
- Part 2: Backtests page
  - Added `frontend/app/backtests/page.tsx` to render summary metrics and an equity curve from backtest JSONs.
  - Linked from homepage.
  - Commit title: feat: add Backtests page (summary + equity curve)
  - Commit description: Visualize baseline performance and equity curve using lightweight-charts.

- Part 3: Rolling metrics
  - Enhanced backtester to export rolling 12m Sharpe and drawdown to `data/public/backtest_rolling.json`.
  - Updated Backtests page to render Rolling Sharpe and Drawdown below the equity curve.
  - Commit title: feat: add rolling metrics and charts to Backtests page
  - Commit description: Compute rolling Sharpe/drawdown and visualize for context.

- Part 4: Determinism marker
  - Added `params_hash` (MD5) to backtest summary for reproducibility tracking.
  - Commit title: chore: add params hash to backtest summary
  - Commit description: Include short hash of config in `backtest_baseline.json`.

- Part 5: Monthly returns heatmap
  - Enhanced backtester to export monthly returns as `data/public/backtest_monthly.json`.
  - Backtests page renders a simple monthly heatmap table.
  - Commit title: feat: add monthly returns heatmap to Backtests
  - Commit description: Compute monthly returns and display a compact table for quick scanning.

