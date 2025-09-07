from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

import pandas as pd

try:
    # Reuse tickers from ingestion to avoid drift
    from .ingest_prices import TICKERS  # type: ignore
except Exception:
    TICKERS = ["MSTR", "BTC-USD", "SPY", "QQQ", "^VIX", "UUP", "^TNX"]


RAW_DIR = Path("data/raw")
PUBLIC_DIR = Path("data/public")
PUBLIC_MSTR = PUBLIC_DIR / "mstr_ohlcv.json"


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_latest_timestamp(df: pd.DataFrame) -> str | None:
    if df.empty or "timestamp" not in df.columns:
        return None
    # timestamps are strings YYYY-MM-DD in our pipeline
    try:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        if ts.notna().any():
            return str(ts.max().date())
    except Exception:
        return None
    return None


def build_status() -> Dict:
    status: Dict = {
        "last_run_utc": _now_iso_utc(),
        "symbols": {},
        "public": {},
        "stale": False,
    }

    # Raw symbols summary
    for sym in TICKERS:
        raw_path = RAW_DIR / f"{sym.replace('^', '_')}.json"
        entry = {"exists": raw_path.exists()}
        if raw_path.exists():
            try:
                df = pd.read_json(raw_path)
                entry["rows"] = int(len(df))
                entry["latest"] = _safe_latest_timestamp(df)
            except Exception:
                entry["rows"] = None
                entry["latest"] = None
        status["symbols"][sym] = entry

    # Public MSTR summary
    pub = {"exists": PUBLIC_MSTR.exists()}
    if PUBLIC_MSTR.exists():
        try:
            dfp = pd.read_json(PUBLIC_MSTR)
            pub["rows"] = int(len(dfp))
            pub["latest"] = _safe_latest_timestamp(dfp)
            # Staleness: mark stale only on trading weekdays (simple weekend logic)
            now_utc = pd.Timestamp.utcnow()
            today = now_utc.date()
            is_weekend = now_utc.dayofweek >= 5  # 5=Sat, 6=Sun
            latest = pd.to_datetime(pub["latest"]).date() if pub.get("latest") else None
            if is_weekend:
                status["stale"] = False
            else:
                status["stale"] = latest is None or latest < today
        except Exception:
            pub["rows"] = None
            pub["latest"] = None
            status["stale"] = True
    else:
        status["stale"] = True
    status["public"]["mstr_ohlcv"] = pub

    return status


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    status = build_status()
    with (PUBLIC_DIR / "status.json").open("w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


