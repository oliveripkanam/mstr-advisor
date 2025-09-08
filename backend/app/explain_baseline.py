from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import pandas as pd

TECH_PATH = Path("data/public/mstr_technical.json")
XASSET_PATH = Path("data/public/mstr_crossasset.json")
BASELINE_PATH = Path("data/public/baseline_signal.json")
OUT_PATH = Path("data/public/explain_latest.json")


def latest_row(path: Path, cols: List[str] | None = None) -> pd.Series:
    df = pd.read_json(path)
    if cols is not None:
        df = df[cols + (["timestamp"] if "timestamp" in df.columns and "timestamp" not in cols else [])]
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    return df.iloc[-1]


def format_num(x: float) -> str:
    return f"{x:.2f}"


def build_drivers(tech: pd.Series, xas: pd.Series, baseline: Dict) -> List[Dict]:
    drivers: List[Dict] = []
    # Trend
    if float(tech.get("close", 0)) > float(tech.get("sma50", 0)) > float(tech.get("sma200", 0)):
        drivers.append({"name": "Trend", "detail": "Price > 50DMA > 200DMA", "impact": "+"})
    elif float(tech.get("close", 0)) < float(tech.get("sma50", 0)):
        drivers.append({"name": "Trend", "detail": "Price below 50DMA", "impact": "-"})

    # RSI
    rsi = float(tech.get("rsi14", 50))
    if rsi >= 80:
        drivers.append({"name": "RSI", "detail": f"RSI {format_num(rsi)} (very high)", "impact": "-"})
    elif rsi >= 70:
        drivers.append({"name": "RSI", "detail": f"RSI {format_num(rsi)} (high)", "impact": "0"})
    elif rsi <= 30:
        drivers.append({"name": "RSI", "detail": f"RSI {format_num(rsi)} (low)", "impact": "+"})

    # Macro regimes
    vix_band = xas.get("vix_band")
    if pd.notna(vix_band):
        if str(vix_band) == "high":
            drivers.append({"name": "VIX", "detail": "High VIX regime", "impact": "-"})
        elif str(vix_band) == "low":
            drivers.append({"name": "VIX", "detail": "Low VIX regime", "impact": "+"})

    uup_trend = xas.get("uup_trend_up")
    if pd.notna(uup_trend) and int(uup_trend) == 1:
        drivers.append({"name": "USD (UUP)", "detail": "USD uptrend", "impact": "-"})

    # Correlations (20d) – informational driver
    for key, label in [("corr_BTCUSD_20", "BTC 20d corr"), ("corr_SPY_20", "SPY 20d corr")]:
        val = xas.get(key)
        if pd.notna(val):
            drivers.append({"name": label, "detail": f"{format_num(float(val))}", "impact": "info"})

    # AT R (risk sizing info)
    atr = float(tech.get("atr14", 0))
    drivers.append({"name": "ATR", "detail": f"ATR(14) {format_num(atr)} (sizing)", "impact": "info"})

    # Baseline action as first summary driver
    if baseline:
        drivers.insert(0, {"name": "Action", "detail": baseline.get("action"), "impact": "info"})

    # keep top 5 items; ensure unique by (name, detail)
    seen = set()
    dedup: List[Dict] = []
    for d in drivers:
        key = (d["name"], d["detail"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(d)
        if len(dedup) >= 5:
            break
    return dedup


def build_narrative(baseline: Dict) -> str:
    parts = []
    if baseline.get("action"):
        parts.append(f"Action: {baseline['action']}")
    if baseline.get("confidence") is not None:
        parts.append(f"Confidence {int(baseline['confidence'])}%")
    if baseline.get("why"):
        parts.append(baseline["why"])
    text = ". ".join(parts)
    # cap to ~160 chars for UI brevity
    return (text[:157] + "…") if len(text) > 160 else text


def main() -> None:
    tech = latest_row(TECH_PATH)
    xas = latest_row(XASSET_PATH)
    baseline: Dict = {}
    if BASELINE_PATH.exists():
        with BASELINE_PATH.open("r", encoding="utf-8") as f:
            baseline = json.load(f)

    drivers = build_drivers(tech, xas, baseline)
    narrative = build_narrative(baseline)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "timestamp": str(tech.get("timestamp", xas.get("timestamp", "")) if hasattr(tech.get("timestamp"), "date") else tech.get("timestamp", "")),
        "narrative": narrative,
        "drivers": drivers,
    }
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


