import json
import os
from datetime import datetime, timezone

import yfinance as yf


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_float(x):
    try:
        v = float(x)
        if v != v:  # NaN check
            return None
        return v
    except Exception:
        return None


def get_intraday_last_price(ticker: str) -> float | None:
    try:
        df = yf.Ticker(ticker).history(period="1d", interval="1m", auto_adjust=False)
        if df is None or df.empty:
            return None
        last_close = df["Close"].dropna()
        if last_close.empty:
            return None
        return safe_float(last_close.iloc[-1])
    except Exception:
        return None


def get_prev_close(ticker: str) -> float | None:
    try:
        df = yf.Ticker(ticker).history(period="5d", interval="1d", auto_adjust=False)
        if df is None or df.empty:
            return None
        closes = df["Close"].dropna()
        if closes.empty:
            return None
        if len(closes) >= 2:
            return safe_float(closes.iloc[-2])
        return safe_float(closes.iloc[-1])
    except Exception:
        return None


def main() -> None:
    symbol = "MSTR"
    last_price = get_intraday_last_price(symbol)
    prev_close = get_prev_close(symbol)
    change_pct = None
    if last_price is not None and prev_close not in (None, 0):
        change_pct = (last_price - prev_close) / prev_close

    payload = {
        "asof_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "symbol": symbol,
        "last_price": last_price,
        "prev_close": prev_close,
        "change_pct": change_pct,
        "market_open": last_price is not None,
    }

    out_dir = os.path.join("data", "public")
    ensure_dir(out_dir)
    out_path = os.path.join(out_dir, "hot.json")

    # Write only if changed to minimize noise
    prev = None
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                prev = json.load(f)
        except Exception:
            prev = None

    if prev == payload:
        print("No change in hot.json; skipping write")
        return

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print("Wrote:", out_path)


if __name__ == "__main__":
    main()


