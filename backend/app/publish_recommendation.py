from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict

SRC = Path("data/public/baseline_signal.json")
DST = Path("data/public/latest_recommendation.json")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not SRC.exists():
        raise FileNotFoundError(f"Missing source recommendation: {SRC}")
    with SRC.open("r", encoding="utf-8") as f:
        rec: Dict = json.load(f)

    # Ensure minimal fields and add symbol for clarity
    rec_out: Dict = {
        "symbol": "MSTR",
        "timestamp": rec.get("timestamp"),
        "action": rec.get("action"),
        "entry_zone": rec.get("entry_zone"),
        "stop": rec.get("stop"),
        "take_profit": rec.get("take_profit"),
        "confidence": rec.get("confidence"),
        "why": rec.get("why"),
    }

    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open("w", encoding="utf-8") as f:
        json.dump(rec_out, f, ensure_ascii=False)
    logging.info("Wrote %s", DST)


if __name__ == "__main__":
    main()


