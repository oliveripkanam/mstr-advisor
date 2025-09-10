from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit
from pandas.tseries.offsets import BDay


TECH_PATH = Path("data/public/mstr_ohlcv.json")
FEAT_PATH = Path("data/public/mstr_technical.json")
OUT_PATH = Path("data/public/close_predictions.json")


def load_df() -> pd.DataFrame:
    ohlcv = pd.read_json(TECH_PATH)
    tech = pd.read_json(FEAT_PATH)
    for df in (ohlcv, tech):
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    # Avoid duplicate 'close' columns after merge
    if "close" in tech.columns:
        tech = tech.drop(columns=["close"])
    df = pd.merge_asof(
        ohlcv.sort_values("timestamp"),
        tech.sort_values("timestamp"),
        on="timestamp",
    )
    # Ensure canonical column names
    if "close" not in df.columns and "close_x" in df.columns:
        df = df.rename(columns={"close_x": "close"})
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

    # Append-only prediction log
    # Determine next trading date (approximate using business day)
    last_bar_date: pd.Timestamp = pd.Timestamp(df["timestamp"].iloc[-1]).normalize()
    next_trading_date: pd.Timestamp = (last_bar_date + BDay(1)).normalize()
    next_date_str = next_trading_date.strftime("%Y-%m-%d")

    # Load existing history if present
    existing_history: List[dict] = []
    if OUT_PATH.exists():
        try:
            prev = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            existing_history = list(prev.get("history", []))
        except Exception:
            existing_history = []

    # Update any rows where actual is now known
    close_by_date = {
        pd.Timestamp(ts).strftime("%Y-%m-%d"): float(c)
        for ts, c in zip(df["timestamp"].tolist(), df["close"].astype(float).tolist())
    }
    for row in existing_history:
        d = row.get("date")
        if d in close_by_date and (row.get("actual") is None or isinstance(row.get("actual"), str)):
            row["actual"] = round(close_by_date[d], 2)
            if isinstance(row.get("pred"), (int, float)):
                row["abs_err"] = round(abs(row["actual"] - row["pred"]), 2)

    # Start history from today onward: drop any backfilled rows before the next prediction date
    existing_history = [r for r in existing_history if isinstance(r.get("date"), str) and r["date"] >= next_date_str]

    # Upsert today's prediction for next date
    def find_row(date_str: str) -> Optional[dict]:
        for r in existing_history:
            if r.get("date") == date_str:
                return r
        return None

    r = find_row(next_date_str)
    if r is None:
        existing_history.append({
            "date": next_date_str,
            "actual": None,
            "pred": round(pred_next, 2),
            "abs_err": None,
        })
    else:
        r["pred"] = round(pred_next, 2)
        if isinstance(r.get("actual"), (int, float)):
            r["abs_err"] = round(abs(r["actual"] - r["pred"]), 2)

    # Compute metrics on rows with actuals
    with_actual = [row for row in existing_history if isinstance(row.get("actual"), (int, float)) and isinstance(row.get("pred"), (int, float))]
    if with_actual:
        errors = [abs(r["actual"] - r["pred"]) for r in with_actual]
        maes = float(np.mean(errors))
        mapes = float(np.mean([abs((r["actual"] - r["pred"]) / max(1e-6, r["actual"])) for r in with_actual]) * 100)
    else:
        maes = 0.0
        mapes = 0.0

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump({
            "asof": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "predict_next_close": round(pred_next, 2),
            "history": existing_history,
            "metrics": {"mae": round(maes, 2), "mape": round(mapes, 2), "cv": hist},
        }, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


