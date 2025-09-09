## Near‑Live Updates Plan (Free Tier)

### TL;DR
- Push small JSON “hot” data frequently (every 5–15 min, market hours), fetch it directly from `raw.githubusercontent.com` with cache‑busting, and avoid rebuilding the Pages site.
- Keep the official daily artifacts (backtests, official recs) unchanged; hot data is clearly labeled “intraday preview”.

### Free‑Tier Feasibility (GitHub)
- GitHub Actions minutes: public repos have unlimited minutes (fair‑use). We schedule only during market hours to be courteous.
- Storage: we update a small `hot.json` (≈ 1–5 KB). 40 runs/day × 5 days ≈ 200 writes/week → a few hundred KB/week of Git history. Manageable.
- Bandwidth/rate limits: frontend polls raw URLs every 60–120s while visible; this is well below practical limits. Query params bust CDN cache.
- Cost: $0. No marketplace add‑ons, no servers.

### Design
- Data path: new file `data/public/hot.json` committed to a lightweight branch (recommended: `data-hot`) to avoid Pages rebuilds and keep history contained.
- Workflow: `.github/workflows/hot-data.yml` runs on cron (5–15 min) and `workflow_dispatch`, with `concurrency` set to cancel in‑progress.
- Market‑hours guard: skip runs outside US market hours (9:30–16:10 ET) and weekends/holidays.
- Frontend: poll the raw hot.json URL with `?t=${Date.now()}` and render a small “Live preview” banner with last updated time.
- Official vs preview: keep the main rec card tied to daily JSON; show hot preview as a subtle inline widget (price + delta + timestamp).

### Hot Payload Shape (minimal and stable)
```json
{
  "asof_utc": "2025-01-15T15:04:05Z",
  "symbol": "MSTR",
  "last_price": 612.34,
  "prev_close": 600.10,
  "change_pct": 0.0203,
  "market_open": true
}
```
- Optional fields later: `vix_estimate`, `uup_trend_intraday`, `preview_note`.

### Backend Workflow Sketch (`hot-data.yml`)
- on: schedule: every 10 min during market hours; plus `workflow_dispatch` for manual refresh
- permissions: `contents: write`
- concurrency: group `hot-data`, `cancel-in-progress: true`
- steps:
  1) Checkout
  2) Setup Python 3.11 (cache pip)
  3) Run a tiny script to fetch MSTR 1m or 5m (yfinance), compute last price and prior close (or use previous daily close), write `data/public/hot.json`
  4) Commit only if file content changed (avoid empty commits)

Example market‑hours guard (pseudo‑Python):
```python
from datetime import datetime, time
import pytz
now = datetime.now(pytz.timezone('America/New_York'))
is_weekday = now.weekday() < 5
in_hours = time(9,30) <= now.time() <= time(16,10)
if not (is_weekday and in_hours):
    print('Skipping: outside market hours')
    exit(0)
```

### Frontend Integration Plan
- Raw URL format (branch `data-hot`):
  - `https://raw.githubusercontent.com/<user>/<repo>/data-hot/data/public/hot.json?t=${Date.now()}`
- Polling: every 60–120 seconds when document is visible; pause when hidden.
- UI: small banner near the chart or header:
  - “Live preview • 15:04:05 UTC • +2.0% vs prev close”
- Fallbacks: if 404 or parse error, hide the banner (do not break page).

### Pages Build Isolation
- Keep `pages.yml` path filters to `frontend/**` (and `docs/**` if needed). Hot data commits on `data-hot` must NOT trigger Pages rebuilds.
- Frontend should only fetch hot data via raw URLs, not via the Pages basePath.

### Rollout Steps (Checklist)
1. Create branch `data-hot` from `main`.
2. Add `.github/workflows/hot-data.yml` with cron, concurrency, market‑hours guard, and commit‑only‑if‑changed logic.
3. Add a minimal Python script to write `data/public/hot.json` (MSTR last price, prev close, pct change, timestamps).
4. Update UI to poll raw URL and show the “Live preview” banner; label clearly as preview.
5. Adjust `pages.yml` path filters to avoid rebuild on data commits.
6. Monitor: verify average run time (<1 min), file sizes, and perceived freshness.

### Risks & Mitigations
- Repo history growth: keep payload small; use a dedicated branch; periodically squash or reset the branch (safe for raw fetch).
- API hiccups: guard workflow with retries and fallback to previous value; commit only on change.
- Confusion with official daily: label “preview”; never override daily recommendation JSON.

### Outcome
This achieves minute‑scale freshness for key numbers at zero cost, with minimal compute and storage. It keeps the site snappy by avoiding full redeploys, while the daily pipeline continues to publish the “official” artifacts.


