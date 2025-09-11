## MSTR Advisor – Transparent Scoring Model (Spec)

Goal: a clear, auditable model producing daily/weekly/monthly scores and one blended recommendation. Every term and weight is visible, and a bottom “Equation Panel” shows today’s live inputs and contributions.

### 1) Features and Weights

- Daily score (weights sum to 100%)
  - BTC 1D return × MSTR beta: 25%
  - Trend vs MAs (dist to 20DMA/50DMA, short MA slope): 20%
  - Momentum (RSI14, 10D ROC): 10%
  - Mean reversion (Bollinger %B, dist to 20DMA): 7%
  - Macro risk (VIX regime ↑ negative): 8%
  - USD/DXY (or UUP) strength (↑ negative): 5%
  - Tech beta (QQQ/SPY 1D return): 8%
  - Volatility penalty (ATR% bounded): 10%
  - News sentiment (24–48h): 7%

- Weekly score (weights sum to 100%)
  - BTC 1W return & regime: 30%
  - Trend structure (20/50DMA cross, slopes): 20%
  - Macro risk (VIX, USD): 15%
  - Momentum (RSI weekly, 4W ROC): 10%
  - 52‑week high proximity/structure: 10%
  - News sentiment (7d): 10%
  - Broad market beta (QQQ 1W): 5%

- Monthly score (weights sum to 100%)
  - BTC 1M return & regime: 35%
  - Long trend (50/200DMA slope/cross): 20%
  - Macro risk (VIX regime, USD): 15%
  - Medium‑term momentum (3M ROC): 10%
  - Volatility penalty (ATR% 1M): 10%
  - News sentiment (30d): 5%
  - Market beta (QQQ 1M): 5%

All raw indicators are normalized (z‑score or percent‑rank), then clipped to reasonable bounds before weighting.

### 2) Score → Action

- Blended Score = 50% Daily + 30% Weekly + 20% Monthly
- Thresholds (tunable):
  - ≥ +30: Buy/Add
  - +10 to +30: Accumulate on dips
  - -10 to +10: Hold
  - -30 to -10: Trim/Reduce
  - ≤ -30: Sell/Avoid

### 3) Entry, Stop, Targets

- Entry zone: prior close to 20DMA ± 0.5×ATR(14). If price > 1.5×ATR above 20DMA, wait for pullback into zone.
- Initial stop (long): min(recent swing low − 1×ATR, 20DMA − 1.5×ATR).
- Targets: 2R and 3R (R = entry − stop). Trail using 2×ATR or 20DMA − 1×ATR beyond 2R.
- Position sizing: risk ≈1% of equity per trade. Size = (1% equity) / (entry − stop).

### 4) Price Prediction (D/W/M)

- Model: regularized linear regression (Ridge/Lasso) per horizon using the same feature set; coefficients are published for transparency.
- Output: expected return and confidence (sigma from OOS residuals). Predicted close = prior close × (1 + expected return).
- Training: walk‑forward; gentle coefficient drift limits to preserve interpretability.

### 5) Data Inputs

- MSTR, BTC‑USD, QQQ (or SPY), VIX, USD (DXY or UUP) daily OHLCV
- Rolling indicators: 20/50/200DMA, slopes, RSI, ROC, ATR%, Bollinger %B
- Regimes/correlations: MSTR↔BTC, MSTR↔QQQ (rolling betas)
- News sentiment: keyword‑based, aggregated over 24h/7d/30d

### 6) Equation Panel (UI contract)

At the bottom of the page, display today’s live equation with each term’s normalized value, weight, and point contribution, plus the subtotal/total. Example shape:

```text
DailyScore = 0.25·BTC1D + 0.20·Trend + 0.10·Momentum + 0.07·MeanRev + 0.08·VIX + 0.05·USD + 0.08·TechBeta + 0.10·ATRpen + 0.07·News

Where each term = clipped_normalized_value ∈ [-1, +1], contribution = weight×term×100 pts

Blended = 0.50·DailyScore + 0.30·WeeklyScore + 0.20·MonthlyScore
```

And a live table such as:

```text
Term           Value   Weight   Points
BTC 1D z       +0.80   25%      +20.0
Trend z        +0.30   20%      +6.0
Momentum z     +0.10   10%      +1.0
…
------------------------------------------------
Daily subtotal                  +32.5
Weekly subtotal                 +10.0
Monthly subtotal                +4.0
================================================
Blended score                   +26.5  → Accumulate
```

This panel must recompute on every refresh from the latest JSON artifacts so users can audit how the recommendation is formed from live data.

### 7) Implementation Notes

- Publish: features JSON, per‑horizon scores, blended score, action, entry/stop/targets, and model coefficients for D/W/M.
- Cap individual term contributions to avoid any single input dominating beyond design.
- Keep weights in a small JSON so they can be tuned without code changes; the equation panel should read these live.


