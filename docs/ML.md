ML v1 Overview
==============

Data & Labels
-------------
- Inputs: `mstr_technical.json` + `mstr_crossasset.json` merged on date.
- Labels: `labels_mstr_5d.json` (Up/Flat/Down based on 5‑day forward close).

Model
-----
- GradientBoostingClassifier with isotonic calibration via TimeSeriesSplit (3 splits).
- Probabilities for classes emitted as `ml_latest_probs.json`.
- Lightweight feature importances exported to `ml_feature_importances.json`.

Scheduling
----------
- Weekly (Mon 22:15 UTC) via `ml-weekly.yml`. Baseline remains daily.

Safety & Combine
----------------
- `combine_baseline_ml.py` blends ML confidence with baseline; respects suppression and applies conservative overrides only.

Regression
----------
- `ml-regression.yml` checks a frozen recent window. Sanity gate: probs bounded and sum ≈ 1.


