Launch Notes (v1.0)
===================

Overview
--------
Free-first MSTR advisor with daily baseline recommendations and weekly ML refresh. Static JSON artifacts, GitHub Actions for compute, GitHub Pages for hosting.

Operational Cadence
-------------------
- Daily (22:05 UTC): ingest → status → features → cross-asset → baseline → publish → explain → what_changed → backtest → regimes & change-points → commit.
- Weekly (Mon 22:15 UTC): labels → train ML → combined recommendation → commit.

Guardrails
----------
- Weekend-aware staleness flag. High-VIX confidence cap (≤55). Minimum confidence gating via env `MIN_CONFIDENCE`.

Acceptance
----------
- Run Acceptance workflow. It recomputes backtest and gates on sanity ranges (CAGR ≥ 0, |Sharpe|<10, drawdown ≤ 0).

Known Limits
------------
- Yahoo daily bars can revise after close. Avoid running more than 1–2 times/day.
- ML is lightweight; interpret probabilities qualitatively.


