<p align="center">
  <img src="mstrmonitorlogo.png" alt="MSTR Monitor" width="96" height="96" />
</p>

# MSTR Monitor

Small, transparent stock monitor for MSTR. One page, live price marker, explainable scoring, and clear cadences.

## What it does
- Shows price with MA20/MA60 and a 1‑minute live marker
- Calculates daily/weekly/monthly scores with per‑term contributions
- Displays trade plan (entry zone, stop, targets)
- News list with lightweight sentiment
- Update cadence card so users know what’s fresh

## How data updates
- Price: `data/public/hot.json` every minute (GitHub Actions → `hotdata` branch). Frontend polls raw file.
- Snapshot/Features: built from daily OHLCV + cross‑asset; by default refreshed EOD (can run hourly if wanted).
- Weekly ML + backtests: heavier jobs; kept to weekends.

## Workflows
- `.github/workflows/pages.yml` – builds `frontend/` + `data/public/` and deploys to Pages on pushes to `main`.
- `.github/workflows/hot-data.yml` – writes `data/public/hot.json` every minute to the `hotdata` branch.

Branches:
- `main` – static site (Pages).
- `hotdata` – tiny live artifacts (only `hot.json`).

## Local preview
```bash
python -m http.server 8080
# open http://localhost:8080/frontend/index.html
```

## Deploy
1) Push to `main` → Pages workflow publishes.
2) In repo Settings → Pages → Source: GitHub Actions.
3) Run the “hot-data” workflow once (workflow_dispatch) to seed `hotdata`.

## Stack
- Frontend: static HTML/CSS/Chart.js (no framework)
- Backend scripts: Python + yfinance
- Hosting: GitHub Pages; Live data: raw file from `hotdata`
