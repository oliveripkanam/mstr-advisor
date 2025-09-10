from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict

import feedparser


OUT_NEWS = Path("data/public/news.json")
OUT_SCORE = Path("data/public/news_score.json")


FEEDS: List[Dict[str, str]] = [
    {
        "name": "GoogleNews",
        "url": "https://news.google.com/rss/search?q=MicroStrategy+OR+MSTR&hl=en-US&gl=US&ceid=US:en",
    },
    {
        "name": "CoindeskBitcoin",
        "url": "https://www.coindesk.com/arc/outboundfeeds/rss/category/bitcoin/?outputType=xml",
    },
]


POSITIVE_KEYWORDS = [
    "upgrade",
    "outperform",
    "raises guidance",
    "beats",
    "buyback",
    "approv",
    "rally",
    "surge",
    "etf inflow",
]

NEGATIVE_KEYWORDS = [
    "downgrade",
    "underperform",
    "misses",
    "offering",
    "lawsuit",
    "probe",
    "SEC charges",
    "plunge",
    "selloff",
    "halts",
]


def _utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_time(struct_time) -> datetime:
    try:
        dt = datetime(*struct_time[:6], tzinfo=timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt


def score_title(title: str) -> int:
    t = title.lower()
    for k in POSITIVE_KEYWORDS:
        if k in t:
            return 1
    for k in NEGATIVE_KEYWORDS:
        if k in t:
            return -1
    # Bitcoin directional proxies
    if "bitcoin" in t or "btc" in t:
        if any(w in t for w in ["rises", "up", "gain", "higher"]):
            return 1
        if any(w in t for w in ["falls", "down", "lower", "slump"]):
            return -1
    return 0


def collect_items(hours: int = 48) -> List[Dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    items: List[Dict] = []
    for feed in FEEDS:
        try:
            d = feedparser.parse(feed["url"])  # type: ignore
            for e in d.entries[:100]:
                title = str(getattr(e, "title", "")).strip()
                link = str(getattr(e, "link", "")).strip()
                published = getattr(e, "published_parsed", None) or getattr(e, "updated_parsed", None)
                ts = _parse_time(published) if published else datetime.now(timezone.utc)
                if ts < cutoff:
                    continue
                s = score_title(title)
                items.append({
                    "source": feed["name"],
                    "title": title,
                    "url": link,
                    "published_utc": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "score": s,
                })
        except Exception:
            continue
    # Deduplicate by title
    seen = set()
    deduped = []
    for it in sorted(items, key=lambda x: x["published_utc"], reverse=True):
        key = it["title"].lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)
    return deduped[:50]


def aggregate(items: List[Dict]) -> Dict:
    if not items:
        return {
            "asof_utc": _utcnow(),
            "bias": 0.0,
            "intensity": 0.0,
            "count_24h": 0,
        }
    # Last 24h slice
    now = datetime.now(timezone.utc)
    within_24 = [it for it in items if (now - datetime.strptime(it["published_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)) <= timedelta(hours=24)]
    s = sum(int(it.get("score", 0)) for it in within_24)
    n = max(1, len(within_24))
    bias = max(-1.0, min(1.0, s / n))
    intensity = max(0.0, min(1.0, len(within_24) / 20.0))
    return {
        "asof_utc": _utcnow(),
        "bias": round(bias, 3),
        "intensity": round(intensity, 3),
        "count_24h": len(within_24),
    }


def main() -> None:
    items = collect_items()
    OUT_NEWS.parent.mkdir(parents=True, exist_ok=True)
    with OUT_NEWS.open("w", encoding="utf-8") as f:
        json.dump({"asof_utc": _utcnow(), "items": items}, f, ensure_ascii=False)

    score = aggregate(items)
    with OUT_SCORE.open("w", encoding="utf-8") as f:
        json.dump(score, f, ensure_ascii=False)


if __name__ == "__main__":
    main()


