from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd

TECH_PATH = Path("data/public/mstr_technical.json")
XASSET_PATH = Path("data/public/mstr_crossasset.json")
OUT_PATH = Path("data/public/baseline_signal.json")
STATUS_PATH = Path("data/public/status.json")
NEWS_SCORE_PATH = Path("data/public/news_score.json")


@dataclass
class BaselineInputs:
    timestamp: str
    close: float
    sma50: float
    sma200: float
    rsi14: float
    atr14: float
    vix_band: Optional[str]
    uup_trend_up: Optional[int]


def _latest_row(df: pd.DataFrame) -> pd.Series:
    if "timestamp" not in df.columns:
        raise ValueError("missing timestamp column")
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    return df.iloc[-1]


def read_inputs() -> BaselineInputs:
    if not TECH_PATH.exists():
        raise FileNotFoundError(f"Missing {TECH_PATH}")
    tech = pd.read_json(TECH_PATH)
    t = _latest_row(tech)

    vix_band = None
    uup_trend_up = None
    if XASSET_PATH.exists():
        x = pd.read_json(XASSET_PATH)
        x_row = _latest_row(x)
        vix_band = str(x_row.get("vix_band")) if not pd.isna(x_row.get("vix_band")) else None
        try:
            uup_trend_up = int(x_row.get("uup_trend_up")) if not pd.isna(x_row.get("uup_trend_up")) else None
        except Exception:
            uup_trend_up = None

    return BaselineInputs(
        timestamp=str(t["timestamp"].date() if hasattr(t["timestamp"], "date") else t["timestamp"]),
        close=float(t["close"]),
        sma50=float(t.get("sma50", np.nan)),
        sma200=float(t.get("sma200", np.nan)),
        rsi14=float(t.get("rsi14", np.nan)),
        atr14=float(t.get("atr14", np.nan)),
        vix_band=vix_band,
        uup_trend_up=uup_trend_up,
    )


def decide_action(inp: BaselineInputs) -> Dict:
    trend_up = (inp.close > inp.sma50) and (inp.sma50 > inp.sma200)
    below_sma50 = inp.close < inp.sma50

    action = "Hold"
    rationale_parts = []

    # Trend/momentum
    if trend_up:
        action = "Buy"
        rationale_parts.append("Trend up (price > 50DMA > 200DMA)")
    if below_sma50:
        action = "Reduce"
        rationale_parts.append("Price below 50DMA")

    # RSI guards
    if inp.rsi14 >= 80:
        action = "Reduce"
        rationale_parts.append("RSI very high (>80)")
    elif inp.rsi14 >= 70 and action == "Buy":
        action = "Hold"
        rationale_parts.append("RSI > 70, avoid fresh buys")
    elif inp.rsi14 <= 30 and trend_up and action != "Reduce":
        action = "Buy"
        rationale_parts.append("RSI < 30 pullback within uptrend")

    # Macro overlays
    risk_multiplier = 1.0
    if inp.vix_band == "high":
        risk_multiplier *= 0.6
        rationale_parts.append("High VIX regime: reduce risk")
    if inp.uup_trend_up == 1:
        risk_multiplier *= 0.85
        rationale_parts.append("Strong USD (UUP uptrend): reduce risk")

    # Real-world news overlay (bias/intensity)
    try:
        if NEWS_SCORE_PATH.exists():
            with NEWS_SCORE_PATH.open("r", encoding="utf-8") as f:
                ns = json.load(f)
            bias = float(ns.get("bias", 0.0))  # -1 to +1
            intensity = float(ns.get("intensity", 0.0))  # 0 to 1
            # Adjust confidence and risk multiplier lightly
            risk_multiplier *= max(0.8, min(1.2, 1.0 + (bias * 0.1 * intensity)))
            # If bias is negative and intensity high, tilt away from Buy
            if bias < -0.25 and intensity >= 0.5 and action == "Buy":
                action = "Hold"
            if bias > 0.25 and intensity >= 0.5 and action == "Reduce":
                action = "Hold"
    except Exception:
        pass

    # Risk sizing (ATR)
    atr = max(inp.atr14, 1e-6)
    if action == "Buy":
        entry_min = inp.close - 0.5 * atr
        entry_max = inp.close + 0.5 * atr
        stop = inp.close - (1.75 * atr * risk_multiplier)
        take = inp.close + (2.5 * atr * risk_multiplier)
    elif action == "Reduce":
        # Suggest trimming and tighter stop
        entry_min = inp.close  # not adding on Reduce
        entry_max = inp.close
        stop = inp.close - (1.0 * atr * risk_multiplier)
        take = inp.close + (1.5 * atr * risk_multiplier)
    else:  # Hold
        entry_min = inp.close - 0.25 * atr
        entry_max = inp.close + 0.25 * atr
        stop = inp.close - (1.25 * atr * risk_multiplier)
        take = inp.close + (2.0 * atr * risk_multiplier)

    # Confidence heuristic (0-100)
    confidence = 60
    if trend_up:
        confidence += 10
    if inp.vix_band == "high":
        confidence -= 15
    if inp.rsi14 > 70:
        confidence -= 10
    if inp.rsi14 < 35 and trend_up:
        confidence += 5
    confidence = int(max(0, min(100, confidence)))
    # Extra cap under high VIX regime
    if inp.vix_band == "high":
        confidence = min(confidence, 55)

    why = "; ".join(rationale_parts) if rationale_parts else "Neutral setup"

    result = {
        "timestamp": inp.timestamp,
        "action": action,
        "entry_zone": [round(entry_min, 2), round(entry_max, 2)],
        "stop": round(stop, 2),
        "take_profit": round(take, 2),
        "confidence": confidence,
        "why": why,
        "inputs": {
            "close": round(inp.close, 2),
            "sma50": round(inp.sma50, 2),
            "sma200": round(inp.sma200, 2),
            "rsi14": round(inp.rsi14, 2),
            "atr14": round(inp.atr14, 2),
            "vix_band": inp.vix_band,
            "uup_trend_up": inp.uup_trend_up,
        },
    }

    # Safety rails
    result["suppressed"] = False
    safety_notes = []

    # 1) Stale data gating (from status.json)
    try:
        if STATUS_PATH.exists():
            with STATUS_PATH.open("r", encoding="utf-8") as f:
                status = json.load(f)
            if bool(status.get("stale", False)):
                result["action"] = "Hold"
                result["confidence"] = min(result["confidence"], 50)
                result["suppressed"] = True
                safety_notes.append("Stale data: recommendation suppressed")
    except Exception:
        # If status can't be read, don't crash the pipeline
        pass

    # 2) Minimum confidence gating
    min_conf = int(os.getenv("MIN_CONFIDENCE", "50"))
    if result["confidence"] < min_conf:
        result["action"] = "Hold"
        result["suppressed"] = True
        safety_notes.append(f"Confidence below {min_conf}: recommendation suppressed")

    if safety_notes:
        if result["why"]:
            result["why"] = f"{result['why']}; " + "; ".join(safety_notes)
        else:
            result["why"] = "; ".join(safety_notes)

    return result


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    inp = read_inputs()
    out = decide_action(inp)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    logging.info("Wrote %s", OUT_PATH)


if __name__ == "__main__":
    main()


