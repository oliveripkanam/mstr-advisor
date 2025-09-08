from __future__ import annotations

import json
import logging
from dataclasses import dataclass, asdict
import hashlib
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

INPUT_PATH = Path("data/public/mstr_ohlcv.json")
OUT_SUMMARY = Path("data/public/backtest_baseline.json")
OUT_EQUITY = Path("data/public/backtest_equity.json")
OUT_ROLLING = Path("data/public/backtest_rolling.json")


@dataclass
class BtConfig:
    slippage_bps: float = 10.0  # round-trip slippage in basis points per trade side
    fee_bps: float = 0.0
    execution: str = "close"  # "close" or "next_close"
    start_date: str | None = None


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    close = df["close"]
    high = df["high"]
    low = df["low"]
    sma50 = close.rolling(50, min_periods=1).mean()
    sma200 = close.rolling(200, min_periods=1).mean()
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    rsi = 100 - (100 / (1 + (gain.rolling(14, min_periods=14).mean() / loss.rolling(14, min_periods=14).mean())))
    prev_close = close.shift(1)
    tr = pd.concat([(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=1).mean()
    ind = pd.DataFrame({"sma50": sma50, "sma200": sma200, "rsi14": rsi.fillna(50.0), "atr14": atr14})
    return pd.concat([df, ind], axis=1)


def baseline_signal_row(row: pd.Series) -> int:
    # Returns target position: 1 long, 0 flat, -1 reduce to flat (we'll use 0/1)
    close, sma50, sma200, rsi = row["close"], row["sma50"], row["sma200"], row["rsi14"]
    trend_up = (close > sma50) and (sma50 > sma200)
    below_sma50 = close < sma50
    # default hold = previous pos → we encode signals, then convert to target
    if rsi >= 80:
        return 0
    if trend_up and rsi < 70:
        return 1
    if below_sma50:
        return 0
    return 0


def backtest(df: pd.DataFrame, cfg: BtConfig) -> Dict:
    df = df.copy()
    if cfg.start_date:
        df = df[df["timestamp"] >= cfg.start_date]
    df.reset_index(drop=True, inplace=True)

    # Compute daily returns
    px = df["close"].astype(float)
    ret = px.pct_change().fillna(0.0)

    # Signals/targets
    target = df.apply(baseline_signal_row, axis=1).astype(float)
    # Position follows target (no delay for simplicity using close/close)
    pos = target.shift(0).fillna(0.0)

    # Apply slippage/fees when position changes
    pos_change = pos.diff().fillna(pos)
    # Trading cost per change: half spread per enter/exit (bps to fraction)
    cost = (abs(pos_change) * (cfg.slippage_bps / 10000.0 + cfg.fee_bps / 10000.0))

    # Strategy return
    strat_ret = pos * ret - cost
    equity = (1.0 + strat_ret).cumprod()

    # Metrics
    total_ret = equity.iloc[-1] - 1.0
    days = len(df)
    cagr = (equity.iloc[-1]) ** (252.0 / max(1, days)) - 1.0 if days > 0 else 0.0
    vol = strat_ret.std() * np.sqrt(252.0)
    dd = equity / equity.cummax() - 1.0
    mdd = dd.min()
    sharpe = (strat_ret.mean() * 252.0) / (vol + 1e-9)
    turnover = abs(pos_change).sum() / max(1, days)

    summary = {
        "days": int(days),
        "total_return": round(float(total_ret), 4),
        "CAGR": round(float(cagr), 4),
        "volatility": round(float(vol), 4),
        "max_drawdown": round(float(mdd), 4),
        "sharpe": round(float(sharpe), 4),
        "turnover": round(float(turnover), 4),
        "params": {
            "slippage_bps": cfg.slippage_bps,
            "fee_bps": cfg.fee_bps,
            "execution": cfg.execution,
        },
    }
    # Determinism marker: hash of parameters only (inputs are deterministic daily closes)
    params_json = json.dumps(asdict(cfg), sort_keys=True)
    summary["params_hash"] = hashlib.md5(params_json.encode("utf-8")).hexdigest()[:12]

    # Rolling metrics (12m ~ 252 trading days)
    window = 252
    rolling_sharpe = (strat_ret.rolling(window).mean() * 252.0) / (strat_ret.rolling(window).std() * np.sqrt(252.0) + 1e-9)
    rolling_dd = (equity / equity.cummax() - 1.0)

    return summary, equity, rolling_sharpe, rolling_dd


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(INPUT_PATH)
    df = pd.read_json(INPUT_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
    df = compute_indicators(df)

    cfg = BtConfig()
    summary, equity, rolling_sharpe, rolling_dd = backtest(df, cfg)

    OUT_SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    with OUT_SUMMARY.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False)
    with OUT_EQUITY.open("w", encoding="utf-8") as f:
        json.dump([
            {"timestamp": str(ts.date()), "equity": float(eq)}
            for ts, eq in zip(df["timestamp"], equity)
        ], f, ensure_ascii=False)
    with OUT_ROLLING.open("w", encoding="utf-8") as f:
        json.dump({
            "rolling_sharpe_252": [
                {"timestamp": str(ts.date()), "value": (None if np.isnan(val) else float(val))}
                for ts, val in zip(df["timestamp"], rolling_sharpe)
            ],
            "drawdown": [
                {"timestamp": str(ts.date()), "value": float(val)}
                for ts, val in zip(df["timestamp"], rolling_dd)
            ],
        }, f, ensure_ascii=False)
    logging.info("Wrote %s and %s", OUT_SUMMARY, OUT_EQUITY)


if __name__ == "__main__":
    main()


