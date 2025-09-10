from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit


TECH_PATH = Path("data/public/mstr_ohlcv.json")
FEAT_PATH = Path("data/public/mstr_technical.json")
OUT_PATH = Path("data/public/close_predictions.json")


def load_df() -> pd.DataFrame:
    ohlcv = pd.read_json(TECH_PATH)
    tech = pd.read_json(FEAT_PATH)
    for df in (ohlcv, tech):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = pd.merge_asof(
        ohlcv.sort_values("timestamp"),
        tech.sort_values("timestamp"),
        on="timestamp",
    )
    df = df.dropna(subset=["close"]).copy()
    df["t"] = np.arange(len(df))
    return df


def build_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    # Features from technicals; avoid leakage by using values available at close
    cols = [
        "close",
        "volume",
        "sma10", "sma20", "sma50", "sma200",
        "ema10", "ema20", "ema50", "ema200",
        "rsi14", "atr14",
        "macd", "macd_signal",
    ]
    X = df[cols].copy()
    X = X.fillna(method="ffill").fillna(method="bfill")
    y = df["close"].shift(-1)  # predict next close
    valid = y.notna()
    return X[valid], y[valid]


def backtest_and_fit(X: pd.DataFrame, y: pd.Series) -> Tuple[GradientBoostingRegressor, List[dict]]:
    model = GradientBoostingRegressor(random_state=42)
    tscv = TimeSeriesSplit(n_splits=5)
    hist: List[dict] = []
    preds = np.zeros_like(y, dtype=float)
    for train_idx, test_idx in tscv.split(X):
        Xtr, Xte = X.iloc[train_idx], X.iloc[test_idx]
        ytr, yte = y.iloc[train_idx], y.iloc[test_idx]
        model.fit(Xtr, ytr)
        p = model.predict(Xte)
        preds[test_idx] = p
        mae = float(np.mean(np.abs(p - yte)))
        mape = float(np.mean(np.abs((p - yte) / np.maximum(1e-6, yte))))
        hist.append({"mae": round(mae, 2), "mape": round(100 * mape, 2)})
    model.fit(X, y)
    return model, hist


def main() -> None:
    df = load_df()
    X, y = build_features(df)
    model, hist = backtest_and_fit(X, y)

    # Latest prediction for next close
    latest_features = X.iloc[[-1]]
    pred_next = float(model.predict(latest_features)[0])

    # Build history for evaluation
    dates = df.loc[y.index, "timestamp"].dt.strftime("%Y-%m-%d").tolist()
    actuals = y.values.astype(float).tolist()
    fitted = model.predict(X).astype(float).tolist()
    errors = [abs(a - p) for a, p in zip(actuals, fitted)]
    mae = float(np.mean(errors))
    mape = float(np.mean([abs((a - p) / max(1e-6, a)) for a, p in zip(actuals, fitted)]) * 100)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump({
            "asof": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "predict_next_close": round(pred_next, 2),
            "history": [{"date": d, "actual": round(a, 2), "pred": round(p, 2), "abs_err": round(e, 2)} for d, a, p, e in zip(dates, actuals, fitted, errors)],
            "metrics": {"mae": round(mae, 2), "mape": round(mape, 2), "cv": hist},
        }, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


