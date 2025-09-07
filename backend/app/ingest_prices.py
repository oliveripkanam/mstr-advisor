from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from time import sleep
from typing import Dict, List

import pandas as pd
import yfinance as yf


TICKERS: List[str] = [
    "MSTR",
    "BTC-USD",
    "SPY",
    "QQQ",
    "^VIX",
    "UUP",
    "^TNX",
]

START_DATE = "2018-01-01"
OUTPUT_DIR = Path("data/raw")
MAX_ATTEMPTS = 3
RETRY_SLEEP_SECONDS = 5


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_daily_ohlcv(symbol: str, start_date: str) -> pd.DataFrame:
    df = yf.download(
        symbol,
        start=start_date,
        interval="1d",
        auto_adjust=False,
        progress=False,
        actions=False,
        threads=False,
    )
    if df is None or df.empty:
        return pd.DataFrame()
    # Standardize column names
    df = df.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Adj Close": "adj_close",
            "Volume": "volume",
        }
    )
    # Index as timestamp (date)
    df = df.reset_index()
    if "Date" in df.columns:
        df = df.rename(columns={"Date": "timestamp"})
    elif "Datetime" in df.columns:
        df = df.rename(columns={"Datetime": "timestamp"})
    # Ensure tz-naive ISO date strings for daily bars
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d")
    # Keep only required columns
    keep_cols = ["timestamp", "open", "high", "low", "close", "volume"]
    df = df[[c for c in keep_cols if c in df.columns]].copy()
    return df


def dataframe_to_records(df: pd.DataFrame, symbol: str, source: str, ingested_at: str) -> List[Dict]:
    records: List[Dict] = []
    for _, row in df.iterrows():
        if pd.isna(row.get("close", None)):
            continue
        records.append(
            {
                "timestamp": str(row["timestamp"]),
                "symbol": symbol,
                "open": None if pd.isna(row.get("open")) else float(row.get("open")),
                "high": None if pd.isna(row.get("high")) else float(row.get("high")),
                "low": None if pd.isna(row.get("low")) else float(row.get("low")),
                "close": None if pd.isna(row.get("close")) else float(row.get("close")),
                "volume": None if pd.isna(row.get("volume")) else float(row.get("volume")),
                "source": source,
                "ingested_at": ingested_at,
            }
        )
    return records


def write_json(records: List[Dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)


def ingest_symbol(symbol: str) -> int:
    attempts = 0
    while attempts < MAX_ATTEMPTS:
        try:
            logging.info("Downloading %s from %s", symbol, START_DATE)
            df = fetch_daily_ohlcv(symbol, START_DATE)
            if df.empty:
                logging.warning("No data for %s", symbol)
                return 0
            ingested_at = _now_iso_utc()
            records = dataframe_to_records(df, symbol, source="yfinance", ingested_at=ingested_at)
            out_path = OUTPUT_DIR / f"{symbol.replace('^','_')}.json"
            write_json(records, out_path)
            logging.info("Wrote %d rows → %s", len(records), out_path)
            return len(records)
        except Exception as exc:  # noqa: BLE001
            attempts += 1
            logging.exception("Error ingesting %s (attempt %d/%d): %s", symbol, attempts, MAX_ATTEMPTS, exc)
            if attempts >= MAX_ATTEMPTS:
                raise
            sleep(RETRY_SLEEP_SECONDS)
    return 0


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for ticker in TICKERS:
        total += ingest_symbol(ticker)
    logging.info("Total rows written across symbols: %d", total)


if __name__ == "__main__":
    main()



