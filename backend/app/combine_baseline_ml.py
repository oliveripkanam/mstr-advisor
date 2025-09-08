from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

BASELINE_PATH = Path("data/public/baseline_signal.json")
ML_PROBS_PATH = Path("data/public/ml_latest_probs.json")
OUT_PATH = Path("data/public/latest_recommendation_combined.json")


def load_json(path: Path) -> Dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    if not BASELINE_PATH.exists() or not ML_PROBS_PATH.exists():
        return
    base = load_json(BASELINE_PATH)
    ml = load_json(ML_PROBS_PATH)

    combined = dict(base)
    combined["combined"] = True
    combined["ml_probs"] = ml.get("probs", {})

    # Safety: if suppressed or stale, do not override action
    if base.get("suppressed"):
        combined["why"] = (combined.get("why") or "") + "; ML considered but baseline suppressed"
    else:
        probs: Dict[str, float] = ml.get("probs", {})
        if probs:
            best_label = max(probs, key=probs.get)
            best_p = float(probs[best_label])

            # Adjust confidence (blend baseline with ML certainty)
            base_conf = int(base.get("confidence", 50))
            ml_conf = int(round(best_p * 100))
            blended = int(round(0.7 * base_conf + 0.3 * ml_conf))
            combined["confidence"] = max(0, min(100, blended))

            # Conservative action overrides
            action = str(base.get("action", "Hold"))
            note = []
            if action == "Hold":
                if best_label == "Up" and best_p >= 0.65:
                    action = "Buy"
                    note.append("ML up-signal reinforced")
                elif best_label == "Down" and best_p >= 0.65:
                    action = "Reduce"
                    note.append("ML down-signal reinforced")
            elif action == "Buy" and best_label == "Down" and best_p >= 0.7:
                action = "Hold"
                note.append("ML down-signal tempers Buy")
            elif action == "Reduce" and best_label == "Up" and best_p >= 0.7:
                action = "Hold"
                note.append("ML up-signal tempers Reduce")

            combined["action"] = action
            if note:
                combined["why"] = ((combined.get("why") or "") + "; " + "; ".join(note)).strip("; ")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


