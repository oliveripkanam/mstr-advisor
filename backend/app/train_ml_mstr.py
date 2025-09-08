from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler

FEATURES_PATH = Path("data/public/mstr_technical.json")
XASSET_PATH = Path("data/public/mstr_crossasset.json")
LABELS_PATH = Path("data/public/labels_mstr_5d.json")

OUT_MODEL = Path("data/public/ml_model_meta.json")
OUT_PROBS = Path("data/public/ml_latest_probs.json")


def assemble_dataset() -> Tuple[pd.DataFrame, pd.Series]:
    tech = pd.read_json(FEATURES_PATH)
    xas = pd.read_json(XASSET_PATH)
    lab = pd.read_json(LABELS_PATH)
    for df in (tech, xas, lab):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = tech.merge(xas, on="timestamp", how="inner")
    df = df.merge(lab[["timestamp", "class_5d"]], on="timestamp", how="inner")
    df = df.dropna(subset=["class_5d"]).sort_values("timestamp").reset_index(drop=True)
    y = df.pop("class_5d")
    # simple numeric feature set
    X = df.select_dtypes(include=[np.number]).copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(method="ffill").fillna(method="bfill").fillna(0)
    return X, y


def train_and_calibrate(X: pd.DataFrame, y: pd.Series) -> Tuple[CalibratedClassifierCV, Dict, GradientBoostingClassifier, List[str]]:
    # simple time-series split for calibration; small model to keep CI fast
    tscv = TimeSeriesSplit(n_splits=3)
    base = GradientBoostingClassifier(random_state=42)
    calib = CalibratedClassifierCV(base, method="isotonic", cv=tscv)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    calib.fit(Xs, y)
    meta = {
        "model": "GradientBoostingClassifier + isotonic calibration",
        "splits": 3,
        "n_features": int(X.shape[1]),
    }
    # Train a copy of the base model on the same transformed features to extract importances
    base_imp = GradientBoostingClassifier(random_state=42)
    base_imp.fit(Xs, y)
    feature_names = list(X.columns)
    return calib, meta, base_imp, feature_names


def main() -> None:
    X, y = assemble_dataset()
    model, meta, base_imp, feat_names = train_and_calibrate(X, y)

    # latest probs on last row
    last_X = X.iloc[[-1]]
    last_prob = model.predict_proba(last_X)  # type: ignore[arg-type]
    classes = list(model.classes_)  # type: ignore[attr-defined]
    prob_map = {cls: float(p) for cls, p in zip(classes, last_prob[0])}

    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    with OUT_MODEL.open("w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    with OUT_PROBS.open("w", encoding="utf-8") as f:
        json.dump({"timestamp": pd.Timestamp.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "probs": prob_map}, f, ensure_ascii=False)
    # Feature importances (top 12)
    try:
        imps = base_imp.feature_importances_.tolist()
        pairs = sorted(zip(feat_names, imps), key=lambda t: t[1], reverse=True)[:12]
        out_imp = Path("data/public/ml_feature_importances.json")
        with out_imp.open("w", encoding="utf-8") as f:
            json.dump([{"feature": n, "importance": float(v)} for n, v in pairs], f, ensure_ascii=False)
    except Exception:
        pass


if __name__ == "__main__":
    main()


