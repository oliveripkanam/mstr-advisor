from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import pandas as pd

MSTR_PATH = Path("data/public/mstr_ohlcv.json")
OUT_PATH = Path("data/public/labels_mstr_5d.json")


def main() -> None:
    if not MSTR_PATH.exists():
        raise FileNotFoundError(MSTR_PATH)
    df = pd.read_json(MSTR_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
    close = pd.to_numeric(df["close"], errors="coerce")

    # Future 5d return using next 5th close; align so label belongs to current day (no look-ahead leakage for training when shifted)
    future_close = close.shift(-5)
    fut_ret_5d = (future_close / close - 1.0)

    # 3-class label with simple thresholds
    up_th, down_th = 0.01, -0.01  # +/-1%
    def to_class(r: float | None) -> str | None:
        if r is None or pd.isna(r):
            return None
        if r >= up_th:
            return "Up"
        if r <= down_th:
            return "Down"
        return "Flat"

    labels = pd.DataFrame({
        "timestamp": df["timestamp"],
        "future_return_5d": fut_ret_5d,
    })
    labels["class_5d"] = labels["future_return_5d"].apply(to_class)

    # Drop last 5 rows without future close
    labels = labels.iloc[:-5]
    labels["timestamp"] = labels["timestamp"].dt.strftime("%Y-%m-%d")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(labels.to_dict(orient="records"), f, ensure_ascii=False)


if __name__ == "__main__":
    main()


