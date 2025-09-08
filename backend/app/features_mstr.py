from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

INPUT_PATH = Path("data/public/mstr_ohlcv.json")
OUTPUT_PATH = Path("data/public/mstr_technical.json")


def compute_sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=1).mean()


def compute_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False, min_periods=1).mean()


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    # Wilder's smoothing after seed
    avg_gain = avg_gain.combine_first(
        gain.ewm(alpha=1 / period, adjust=False).mean()
    )
    avg_loss = avg_loss.combine_first(
        loss.ewm(alpha=1 / period, adjust=False).mean()
    )
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(0.0)


def compute_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    ema_fast = compute_ema(close, fast)
    ema_slow = compute_ema(close, slow)
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False, min_periods=1).mean()
    macd_hist = macd - macd_signal
    return pd.DataFrame({
        "macd": macd,
        "macd_signal": macd_signal,
        "macd_hist": macd_hist,
    })


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period, min_periods=1).mean()
    return atr


def compute_bollinger(close: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    mid = close.rolling(window=window, min_periods=1).mean()
    std = close.rolling(window=window, min_periods=1).std(ddof=0)
    upper = mid + num_std * std
    lower = mid - num_std * std
    return pd.DataFrame({
        "bb_mid_20": mid,
        "bb_upper_20_2": upper,
        "bb_lower_20_2": lower,
    })


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_PATH}")

    df = pd.read_json(INPUT_PATH)
    if df.empty:
        raise ValueError("Input mstr_ohlcv.json is empty")

    # Ensure correct dtypes
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    close = df["close"]
    high = df["high"]
    low = df["low"]

    features = pd.DataFrame({
        "timestamp": df["timestamp"].astype(str),
        "close": close,
        "sma10": compute_sma(close, 10),
        "sma20": compute_sma(close, 20),
        "sma50": compute_sma(close, 50),
        "sma200": compute_sma(close, 200),
        "ema10": compute_ema(close, 10),
        "ema20": compute_ema(close, 20),
        "ema50": compute_ema(close, 50),
        "ema200": compute_ema(close, 200),
        "rsi14": compute_rsi(close, 14),
        "atr14": compute_atr(high, low, close, 14),
    })

    macd = compute_macd(close, 12, 26, 9)
    bb = compute_bollinger(close, 20, 2.0)
    features = pd.concat([features, macd, bb], axis=1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    records: List[Dict] = features.to_dict(orient="records")
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    logging.info("Wrote %s with %d rows", OUTPUT_PATH, len(features))


if __name__ == "__main__":
    main()


