from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

import pandas as pd

XASSET_PATH = Path("data/public/mstr_crossasset.json")
OUT_PATH = Path("data/public/regimes_mstr.json")


def latest_row(df: pd.DataFrame) -> pd.Series:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    return df.iloc[-1]


def classify_vol(vix_band: str | None) -> str:
    if vix_band is None:
        return "unknown"
    v = str(vix_band)
    if v in ("low", "med", "high"):
        return v
    return "unknown"


def classify_corr(corr: float | None) -> str:
    if corr is None or pd.isna(corr):
        return "unknown"
    if corr >= 0.4:
        return "positively_correlated"
    if corr <= -0.2:
        return "negatively_correlated"
    return "neutral"


def main() -> None:
    if not XASSET_PATH.exists():
        raise FileNotFoundError(XASSET_PATH)
    df = pd.read_json(XASSET_PATH)
    row = latest_row(df)

    vix_band = row.get("vix_band")
    corr60 = None
    if "corr_BTCUSD_60" in row:
        try:
            corr60 = float(row["corr_BTCUSD_60"])  # type: ignore[assignment]
        except Exception:
            corr60 = None

    regimes: Dict[str, object] = {
        "timestamp": str(row["timestamp"].date()) if hasattr(row["timestamp"], "date") else str(row["timestamp"]),
        "volatility": classify_vol(str(vix_band) if pd.notna(vix_band) else None),
        "btc_correlation_60d": classify_corr(corr60),
        "raw": {
            "vix_band": (None if pd.isna(vix_band) else str(vix_band)),
            "corr_BTCUSD_60": (None if corr60 is None else round(corr60, 3)),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(regimes, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


