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

## Weekly Plan (7 Weeks)

### Week 1 (Sep 8–Sep 14, 2025) — Repo, CI, Data Ingest MVP
**Goals**: Repo scaffolding, GitHub Pages, scheduled EOD pulls to artifacts
**Deliverables**: Workflow runs daily and commits `mstr_ohlcv.json`, `status.json`

- DONE Day 1: Confirm repo visibility (public), enable GitHub Pages, set folders, add `.env.example`
- DONE Day 2: Add GitHub Actions workflow (cron 22:05 UTC, Python setup/cache, retries)
- DONE Day 3: Implement `yfinance` pulls (MSTR, BTC-USD, SPY, QQQ, ^VIX, UUP, ^TNX); idempotent writes
- Day 4: Normalize to clean schema; write `data/public/mstr_ohlcv.json`; basic validation checks
- Day 5: `status.json` with timestamps/sources; full end‑to‑end dry run passes
- Day 6: Add logging/backoff/timezone handling; verify holiday behavior; schedule smoke test
- Day 7: Documentation pass for data ingest; fix issues from smoke test

### Week 2 (Sep 15–Sep 21, 2025) — Features and Baseline Rules
**Goals**: Core technical + cross‑asset features; baseline recommendation JSON
**Deliverables**: `latest_recommendation.json`, `explain_latest.json`, `what_changed.json`

- Day 1: SMA/EMA/RSI/MACD/ATR/Bollinger for MSTR; cache intermediate frames
- Day 2: Cross‑asset: 20/60d correlations (BTC/SPY/QQQ), VIX bands, UUP trend, ^TNX delta
- Day 3: Baseline rule engine (trend filter, RSI guards, ATR sizing, macro overlays) → action
- Day 4: Rationale (plain English) + confidence heuristic; write `latest_recommendation.json`
- Day 5: “What changed” vs prior day; finalize JSON schemas; dry run on a full week
- Day 6: Safety rails v1: stale‑data checks, high‑VIX caps, min confidence gating
- Day 7: Pipeline refactor/cleanup; update docs; confirm daily job stability

### Week 3 (Sep 22–Sep 28, 2025) — Frontend MVP (Static)
**Goals**: Next.js scaffold with static data; desktop/mobile responsive
**Deliverables**: Dashboard with Today’s Recommendation and price chart

- Day 1: Next.js + Tailwind scaffold; base layout; color‑blind‑safe palette
- Day 2: PriceChart using Lightweight Charts reading `mstr_ohlcv.json`
- Day 3: RecommendationCard (action, entry/stop/TP, confidence, rationale)
- Day 4: Explainer view + “What changed”; responsive/mobile polish
- Day 5: Glossary tooltips wired to `configs/glossary.yaml`; basic accessibility
- Day 6: Mobile responsiveness; keyboard navigation; contrast checks
- Day 7: Static export build; GitHub Pages config; perf checks

### Week 4 (Sep 29–Oct 5, 2025) — Backtesting Basics
**Goals**: Deterministic daily backtester; baseline performance
**Deliverables**: Backtest metrics JSON + charts, Backtests page

- Day 1: Event-driven backtester (daily bars; close vs next‑open toggle; slippage/fees)
- Day 2: Run baseline 2018–present; persist metrics JSON (CAGR, MDD, Sharpe, turnover)
- Day 3: Generate equity/drawdown/rolling Sharpe series JSON
- Day 4: Frontend Backtests page; summary cards and charts
- Day 5: Determinism check on frozen sample; parameter hashes recorded
- Day 6: Backtest docs; example report JSON and charts wired
- Day 7: Bugfixes; refactor for clarity; re‑run baseline

### Week 5 (Oct 6–Oct 12, 2025) — Explainability (Rules First)
**Goals**: Clear, beginner‑friendly narratives and drivers
**Deliverables**: Top‑3 drivers extraction; finalized “Why” narratives

- Day 1: Rationale templates; jargon‑light; thresholds for signal mentions
- Day 2: Rank features per day; map to drivers; cap verbosity; add glossary links
- Day 3: “Why” page polish; consistent tone and lengths
- Day 4: Payload size audit; keep daily JSON < ~1–2 MB
- Day 5: Edge cases: stale data, missing symbols; graceful degradation
- Day 6: Copy and tone polish; glossary expansion where needed
- Day 7: QA pass; fix narrative edge cases

### Week 6 (Oct 13–Oct 19, 2025) — ML v1 (Optional, Free)
**Goals**: 5‑day classifier; calibrated probabilities; runtime within Actions budget
**Deliverables**: Model artifact (small), probabilities merged with baseline

- Day 1: Labels with strict close alignment; freeze features; walk‑forward CV
- Day 2: Train LightGBM/XGBoost on trimmed history; cache model; runtime profiling
- Day 3: Calibrate (isotonic/Platt); score latest; combine via expected utility and risk rails
- Day 4: SHAP on latest day only (TreeSHAP) or feature importances if runtime tight
- Day 5: Frontend: probability/confidence visualization; ML toggle in config
- Day 6: Runtime budget and scheduling: baseline daily, ML weekly (if needed)
- Day 7: QA/regression tests on frozen sample; finalize ML docs

### Week 7 (Oct 20–Oct 26, 2025) — Regimes, Robustness, Reporting & Launch
**Goals**: Regimes and safety rails; reporting; CI; launch
**Deliverables**: Regime flags JSON, rolling/heatmap metrics, CI checks, v1.0 launch

- Day 1: Volatility buckets and BTC correlation regimes; cache regime state
- Day 2: Optional HMM/ruptures on reduced features (guarded by runtime)
- Day 3: Enforce stale‑data checks; high‑VIX risk caps; min confidence gating
- Day 4: Rolling 12m Sharpe/drawdown/hit‑rate series; monthly returns heatmap JSON
- Day 5: Data Status page; a11y polish (keyboard nav, contrast); copy polish
- Day 6: CI/CD: formatting/lint/tests; integration test workflow on frozen data
- Day 7: Final acceptance backtests; runtime audit; tag v1.0; smoke test; launch notes; maintenance schedule

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


