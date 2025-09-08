## MSTR Advisor — Free-First Build Plan (starting Sep 7, 2025)

This plan delivers a 100% free, automated, daily MSTR advisor (manual execution only). It uses GitHub Actions (scheduler/compute) and GitHub Pages (hosting) with static JSON artifacts—no servers, no paid APIs.

### Locked Free Stack
- **Scheduler**: GitHub Actions cron (public repo recommended)
- **Hosting**: GitHub Pages (Next.js static export)
- **APIs/Data**: `yfinance` only (tickers: `MSTR, BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX`)
- **Artifacts for frontend** (committed daily):
  - `data/public/latest_recommendation.json`
  - `data/public/mstr_ohlcv.json`
  - `data/public/explain_latest.json`
  - `data/public/what_changed.json`
  - `data/public/status.json`
  - `configs/glossary.yaml` (static)
- **Cadence**: Daily after US close (~22:05 UTC), with retries
- **Secrets**: None for v1

---

## Plan by Day (Parts 1–7 each)

Day 1 — Repo, CI, Data Ingest MVP
- DONE Part 1: Confirm repo visibility (public), enable GitHub Pages, set folders, add `.env.example`
- DONE Part 2: Add GitHub Actions workflow (cron 22:05 UTC, Python setup/cache, retries)
- DONE Part 3: Implement `yfinance` pulls (MSTR, BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX); idempotent writes
- DONE Part 4: Normalize to clean schema; write `data/public/mstr_ohlcv.json`; basic validation checks
- DONE Part 5: Enhanced `status.json` (per‑symbol counts/latest, public summary, weekend staleness)
- DONE Part 6: Add logging/backoff/timezone handling; smoke workflow; verify weekend logic
- DONE Part 7: Documentation pass (README, docs/INGEST.md); fix issues from smoke test

Day 2 — Features and Baseline Rules
- DONE Part 1: SMA/EMA/RSI/MACD/ATR/Bollinger for MSTR; cache intermediate frames
- DONE Part 2: Cross‑asset: 20/60d correlations (BTC/SPY/QQQ), VIX bands, UUP trend, ^TNX delta
- DONE Part 3: Baseline rule engine (trend filter, RSI guards, ATR sizing, macro overlays) → action
- Part 4: Rationale (plain English) + confidence heuristic; write `latest_recommendation.json`
- Part 5: “What changed” vs prior day; finalize JSON schemas; dry run on a full week
- Part 6: Safety rails v1: stale‑data checks, high‑VIX caps, min confidence gating
- Part 7: Pipeline refactor/cleanup; update docs; confirm daily job stability

Day 3 — Frontend MVP (Static)
- Part 1: Next.js + Tailwind scaffold; base layout; color‑blind‑safe palette
- Part 2: PriceChart using Lightweight Charts reading `mstr_ohlcv.json`
- Part 3: RecommendationCard (action, entry/stop/TP, confidence, rationale)
- Part 4: Explainer view + “What changed”; responsive/mobile polish
- Part 5: Glossary tooltips wired to `configs/glossary.yaml`; basic accessibility
- Part 6: Mobile responsiveness; keyboard navigation; contrast checks
- Part 7: Static export build; GitHub Pages config; perf checks

Day 4 — Backtesting Basics
- Part 1: Event-driven backtester (daily bars; close vs next‑open toggle; slippage/fees)
- Part 2: Run baseline 2018–present; persist metrics JSON (CAGR, MDD, Sharpe, turnover)
- Part 3: Generate equity/drawdown/rolling Sharpe series JSON
- Part 4: Frontend Backtests page; summary cards and charts
- Part 5: Determinism check on frozen sample; parameter hashes recorded
- Part 6: Backtest docs; example report JSON and charts wired
- Part 7: Bugfixes; refactor for clarity; re‑run baseline

Day 5 — Explainability (Rules First)
- Part 1: Rationale templates; thresholds for signal mentions; glossary links
- Part 2: Rank features per day; map to drivers; cap verbosity
- Part 3: “Why” page polish; consistent tone and lengths
- Part 4: Payload size audit; keep daily JSON < ~1–2 MB
- Part 5: Edge cases: stale data, missing symbols; graceful degradation
- Part 6: Copy and tone polish; glossary expansion where needed
- Part 7: QA pass; fix narrative edge cases

Day 6 — ML v1 (Optional, Free)
- Part 1: Labels with strict close alignment; freeze features; walk‑forward CV
- Part 2: Train LightGBM/XGBoost on trimmed history; cache model; runtime profiling
- Part 3: Calibrate (isotonic/Platt); score latest; combine via expected utility and risk rails
- Part 4: SHAP on latest day only (TreeSHAP) or feature importances if runtime tight
- Part 5: Frontend: probability/confidence visualization; ML toggle in config
- Part 6: Runtime budget and scheduling: baseline daily, ML weekly (if needed)
- Part 7: QA/regression tests on frozen sample; finalize ML docs

Day 7 — Regimes, Robustness, Reporting & Launch
- Part 1: Volatility buckets and BTC correlation regimes; cache regime state
- Part 2: Optional HMM/ruptures on reduced features (guarded by runtime)
- Part 3: Enforce stale‑data checks; high‑VIX risk caps; min confidence gating
- Part 4: Rolling 12m Sharpe/drawdown/hit‑rate series; monthly returns heatmap JSON
- Part 5: Data Status page; a11y polish (keyboard nav, contrast); copy polish
- Part 6: CI/CD: formatting/lint/tests; integration test workflow on frozen data
- Part 7: Final acceptance backtests; runtime audit; tag v1.0; smoke test; launch notes; maintenance schedule

---

## Daily Cadence (Automated Job)
1) Fetch latest bars (EOD) via `yfinance`
2) Validate freshness; stop if stale
3) Compute features for latest day
4) Score baseline (and ML if enabled)
5) Generate recommendation JSON + explanation + deltas
6) Commit updated artifacts to `data/public/`
7) GitHub Pages updates site automatically

## Acceptance Criteria (Go‑Live)
- One‑click daily run produces recommendation with entry/stop/TP, confidence, rationale, updated charts
- Backtests show risk‑adjusted improvement vs benchmark out‑of‑sample
- App is stable, documented, beginner‑friendly; 0 paid services


