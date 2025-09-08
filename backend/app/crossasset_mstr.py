from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

MSTR_PATH = Path("data/public/mstr_ohlcv.json")
RAW_DIR = Path("data/raw")
OUTPUT_PATH = Path("data/public/mstr_crossasset.json")


def load_series(path: Path, value_col: str = "close") -> pd.DataFrame:
    df = pd.read_json(path)
    if df.empty:
        raise ValueError(f"Empty input: {path}")
    if "timestamp" not in df.columns:
        raise ValueError(f"Missing timestamp in {path}")
    if value_col not in df.columns:
        raise ValueError(f"Missing {value_col} in {path}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    return df[["timestamp", value_col]].rename(columns={value_col: path.stem})


def compute_returns(s: pd.Series) -> pd.Series:
    return s.pct_change()


def compute_rolling_corr(a: pd.Series, b: pd.Series, window: int) -> pd.Series:
    return a.rolling(window).corr(b)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not MSTR_PATH.exists():
        raise FileNotFoundError("Missing MSTR input")

    mstr = load_series(MSTR_PATH, "close").rename(columns={"mstr_ohlcv": "MSTR"})
    btc = load_series(RAW_DIR / "BTC-USD.json", "close").rename(columns={"BTC-USD": "BTCUSD"})
    spy = load_series(RAW_DIR / "SPY.json", "close")
    qqq = load_series(RAW_DIR / "QQQ.json", "close")
    vix = load_series(RAW_DIR / "_VIX.json", "close").rename(columns={"_VIX": "VIX"})
    uup = load_series(RAW_DIR / "UUP.json", "close")
    tnx = load_series(RAW_DIR / "_TNX.json", "close").rename(columns={"_TNX": "TNX"})

    # Align by timestamp (inner join to avoid lookahead)
    df = mstr.merge(btc, on="timestamp", how="inner")
    df = df.merge(spy, on="timestamp", how="inner")
    df = df.merge(qqq, on="timestamp", how="inner")
    df = df.merge(vix, on="timestamp", how="inner")
    df = df.merge(uup, on="timestamp", how="inner")
    df = df.merge(tnx, on="timestamp", how="inner")

    # Returns
    for col in ["MSTR", "BTCUSD", "SPY", "QQQ"]:
        df[f"ret_{col}"] = compute_returns(df[col])

    # Rolling correlations with MSTR (20, 60 days)
    for base in ["BTCUSD", "SPY", "QQQ"]:
        for w in [20, 60]:
            df[f"corr_{base}_{w}"] = compute_rolling_corr(df["ret_MSTR"], df[f"ret_{base}"], w)

    # Regime flags (simple):
    # - VIX bands: low < 18, medium 18–25, high > 25
    df["vix_band"] = pd.cut(df["VIX"], bins=[-1, 18, 25, 1e9], labels=["low", "med", "high"])
    # - UUP trend (20d > 60d → uptrend)
    df["uup_sma20"] = df["UUP"].rolling(20).mean()
    df["uup_sma60"] = df["UUP"].rolling(60).mean()
    df["uup_trend_up"] = (df["uup_sma20"] > df["uup_sma60"]).astype(int)
    # - TNX delta (5d change)
    df["tnx_delta_5d"] = df["TNX"].diff(5)

    out_cols: List[str] = [
        "timestamp",
        "corr_BTCUSD_20", "corr_BTCUSD_60",
        "corr_SPY_20", "corr_SPY_60",
        "corr_QQQ_20", "corr_QQQ_60",
        "vix_band", "uup_trend_up", "tnx_delta_5d",
    ]
    out = df[out_cols].copy()
    out["timestamp"] = out["timestamp"].astype(str)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    records: List[Dict] = out.to_dict(orient="records")
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    logging.info("Wrote %s with %d rows", OUTPUT_PATH, len(out))


if __name__ == "__main__":
    main()


