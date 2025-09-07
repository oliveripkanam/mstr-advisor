from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict

import pandas as pd

RAW_PATH = Path("data/raw/MSTR.json")
OUT_PATH = Path("data/public/mstr_ohlcv.json")


def _utc_today_date() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(timezone.utc).date())


def load_raw(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing raw file: {path}")
    with path.open("r", encoding="utf-8") as f:
        records: List[Dict] = json.load(f)
    df = pd.DataFrame.from_records(records)
    return df


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        raise ValueError("Raw MSTR is empty")

    # Ensure required columns exist
    required = ["timestamp", "open", "high", "low", "close", "volume"]
    for col in required:
        if col not in df.columns:
            df[col] = pd.NA

    # Parse and sort timestamps
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=False, errors="coerce").dt.date
    df = df.dropna(subset=["timestamp"]).copy()
    df = df.sort_values("timestamp").drop_duplicates(subset=["timestamp"], keep="last")

    # Drop any future dates
    today = _utc_today_date()
    df = df[df["timestamp"] <= today.date()]

    # Coerce numerics
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Basic hygiene: drop rows with missing close
    before = len(df)
    df = df.dropna(subset=["close"])  # must have a close
    after = len(df)
    if after == 0:
        raise ValueError("All rows dropped due to missing close")
    if after < before:
        logging.warning("Dropped %d rows with missing close", before - after)

    # Final ordering and types
    df = df[["timestamp", "open", "high", "low", "close", "volume"]]
    df["timestamp"] = df["timestamp"].astype(str)
    return df


def write_public(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    records = df.to_dict(orient="records")
    with path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("Normalizing MSTR → %s", OUT_PATH)
    raw = load_raw(RAW_PATH)
    clean = normalize(raw)
    # Sanity checks
    assert len(clean) > 0
    assert list(clean.columns) == ["timestamp", "open", "high", "low", "close", "volume"]
    # Timestamps increasing
    assert clean["timestamp"].is_monotonic_increasing
    write_public(clean, OUT_PATH)
    logging.info("Wrote %d rows", len(clean))


if __name__ == "__main__":
    main()


