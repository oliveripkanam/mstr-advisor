from __future__ import annotations

import json
from datetime import datetime, timezone

import yfinance as yf


def main() -> None:
    t = yf.Ticker("MSTR")
    # Prefer fast_info for speed
    try:
        fi = t.fast_info
        last = float(fi.get("last_price") or fi.get("last_close") or 0.0)
        prev = float(fi.get("previous_close") or 0.0)
    except Exception:
        fi = {}
        last = 0.0
        prev = 0.0

    # Fallback using quote summary if needed
    if not last or last <= 0:
        try:
            info = t.info
            last = float(info.get("regularMarketPrice") or 0.0)
            prev = float(info.get("regularMarketPreviousClose") or 0.0)
        except Exception:
            pass

    change = (last - prev) if last and prev else 0.0
    change_pct = (change / prev * 100.0) if prev else 0.0

    payload = {
        "asof_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "symbol": "MSTR",
        "price": round(last, 2),
        "prev_close": round(prev, 2) if prev else None,
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
    }

    out = "data/public/hot.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"Wrote {out}: {payload}")


if __name__ == "__main__":
    main()


