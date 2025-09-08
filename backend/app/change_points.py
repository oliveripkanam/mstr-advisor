from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict

import numpy as np
import pandas as pd

MSTR_PATH = Path("data/public/mstr_ohlcv.json")
OUT_PATH = Path("data/public/change_points_mstr.json")


def cusum_events(returns: pd.Series, threshold: float = 0.04, drift: float = 0.0) -> List[int]:
    """Simple CUSUM filter to flag change points on returns.
    Returns indices of change events.
    """
    pos, neg = 0.0, 0.0
    events: List[int] = []
    for i, r in enumerate(returns.fillna(0.0)):
        pos = max(0.0, pos + r - drift)
        neg = min(0.0, neg + r + drift)
        if pos > threshold:
            events.append(i)
            pos = 0.0
            neg = 0.0
        elif neg < -threshold:
            events.append(i)
            pos = 0.0
            neg = 0.0
    return sorted(set(events))


def main() -> None:
    if not MSTR_PATH.exists():
        raise FileNotFoundError(MSTR_PATH)
    df = pd.read_json(MSTR_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
    px = pd.to_numeric(df["close"], errors="coerce").fillna(method="ffill").fillna(method="bfill")
    ret = px.pct_change()

    # Use a volatility-adaptive threshold based on rolling std (~60d)
    vol = ret.rolling(60, min_periods=30).std().fillna(ret.std())
    thr = (2.0 * vol).clip(lower=0.03, upper=0.10)  # between 3% and 10%

    idxs: List[int] = []
    # Slide windows to allow varying thresholds
    for start in range(0, len(ret), 200):
        end = min(len(ret), start + 400)
        window = ret.iloc[start:end]
        t = float(thr.iloc[start:end].median()) if end - start > 0 else 0.05
        local = cusum_events(window, threshold=t)
        idxs.extend([start + i for i in local])

    idxs = sorted(set([i for i in idxs if i >= 1]))
    changes = [
        {"timestamp": str(df.loc[i, "timestamp"].date()), "index": int(i)}
        for i in idxs
    ]

    segments: List[Dict] = []
    prev = 0
    for i in idxs + [len(df) - 1]:
        if i <= prev:
            continue
        seg = {"start": str(df.loc[prev, "timestamp"].date()), "end": str(df.loc[i, "timestamp"].date())}
        segments.append(seg)
        prev = i + 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump({"changes": changes, "segments": segments}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


