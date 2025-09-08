from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

TECH_PATH = Path("data/public/mstr_technical.json")
XASSET_PATH = Path("data/public/mstr_crossasset.json")
OUT_PATH = Path("data/public/what_changed.json")


def load_df(path: Path) -> pd.DataFrame:
    df = pd.read_json(path)
    if df.empty:
        raise ValueError(f"Empty input: {path}")
    if "timestamp" not in df.columns:
        raise ValueError(f"Missing timestamp in {path}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    return df


def band(value: float, thresholds: Tuple[float, float] = (30.0, 70.0)) -> str:
    lo, hi = thresholds
    if pd.isna(value):
        return "unknown"
    if value < lo:
        return "low"
    if value > hi:
        return "high"
    return "mid"


def collect_changes() -> Dict:
    tech = load_df(TECH_PATH)
    xas = load_df(XASSET_PATH)

    # Align to common last two dates
    common = pd.merge(tech[["timestamp", "close", "sma50", "sma200", "rsi14"]],
                      xas[["timestamp", "vix_band", "uup_trend_up", "corr_BTCUSD_20", "corr_SPY_20", "corr_QQQ_20"]],
                      on="timestamp", how="inner")
    last_two = common.tail(2)
    if len(last_two) < 2:
        raise ValueError("Need at least two common dates to compute changes")

    prev = last_two.iloc[0]
    curr = last_two.iloc[1]

    items: List[str] = []
    deltas: Dict[str, Dict[str, object]] = {}

    # Price vs SMA50 crossover
    prev_above = prev["close"] > prev["sma50"]
    curr_above = curr["close"] > curr["sma50"]
    if prev_above != curr_above:
        direction = "above" if curr_above else "below"
        items.append(f"Price crossed {direction} 50DMA")
        deltas["price_vs_50dma"] = {
            "from": "above" if prev_above else "below",
            "to": direction,
        }

    # SMA50 vs SMA200 crossover (golden/death cross)
    prev_golden = prev["sma50"] > prev["sma200"]
    curr_golden = curr["sma50"] > curr["sma200"]
    if prev_golden != curr_golden:
        items.append("50DMA crossed 200DMA")
        deltas["trend_cross"] = {
            "from": "50>200" if prev_golden else "50<200",
            "to": "50>200" if curr_golden else "50<200",
        }

    # RSI band change
    prev_band = band(float(prev["rsi14"]))
    curr_band = band(float(curr["rsi14"]))
    if prev_band != curr_band:
        items.append(f"RSI moved from {prev_band} to {curr_band}")
        deltas["rsi_band"] = {"from": prev_band, "to": curr_band, "prev": round(float(prev["rsi14"]), 2), "curr": round(float(curr["rsi14"]), 2)}

    # VIX regime change
    pv = str(prev.get("vix_band"))
    cv = str(curr.get("vix_band"))
    if pv != cv:
        items.append(f"VIX regime changed from {pv} to {cv}")
        deltas["vix_band"] = {"from": pv, "to": cv}

    # USD trend flip
    prev_uup = int(prev.get("uup_trend_up")) if not pd.isna(prev.get("uup_trend_up")) else None
    curr_uup = int(curr.get("uup_trend_up")) if not pd.isna(curr.get("uup_trend_up")) else None
    if prev_uup is not None and curr_uup is not None and prev_uup != curr_uup:
        items.append("USD trend flipped")
        deltas["uup_trend_up"] = {"from": prev_uup, "to": curr_uup}

    # Correlation change vs BTC (20d) if large move
    for col, label in [("corr_BTCUSD_20", "BTC 20d corr"), ("corr_SPY_20", "SPY 20d corr"), ("corr_QQQ_20", "QQQ 20d corr")]:
        if col in prev and col in curr:
            try:
                dv = float(curr[col]) - float(prev[col])
            except Exception:
                dv = 0.0
            if abs(dv) >= 0.1:  # significant correlation change
                items.append(f"{label} changed by {dv:+.2f}")
                deltas[col] = {"delta": round(dv, 2), "from": round(float(prev[col]), 2) if not pd.isna(prev[col]) else None, "to": round(float(curr[col]), 2) if not pd.isna(curr[col]) else None}

    if not items:
        items.append("No material changes detected")

    summary = "; ".join(items[:3])

    out = {
        "timestamp": str(curr["timestamp"].date()),
        "items": items,
        "deltas": deltas,
        "summary": summary,
    }
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    changed = collect_changes()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(changed, f, ensure_ascii=False)
    logging.info("Wrote %s", OUT_PATH)


if __name__ == "__main__":
    main()


