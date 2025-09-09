# Visuals Overhaul (Dark‑Only)

This document tracks the UI/UX modernization work. Target: sleek, high‑contrast dark theme with TradingView‑class polish.

## Foundation
- Dark only (no toggle). High-contrast tokens and accessible focus states.
- Libraries: shadcn/ui + Radix Primitives, Tailwind (+ animate), Framer Motion, Lucide icons, chroma-js.
- Charts: Lightweight Charts (price/equity), Visx (sparklines/KPIs), ECharts (heatmap).

### Theme tokens (initial)
- Background: `#0b1220` (bg-950), Panels: `#0f172a` (panel-900)
- Text: `#e5e7eb` (100), Subtext: `#94a3b8` (300)
- Primary `#60a5fa`, Success `#10b981`, Warn `#f59e0b`, Danger `#ef4444`
- Radius 10/14, gaps 8/12/20, border `rgba(255,255,255,0.06)`
- Typeface: Inter (variable), scale 12/14/16/20/24/32

## Rollout Checklist

1) App shell + tokens [ ]
- Install shadcn/ui + Radix; set dark base on `html`/`body`
- Top bar (logo/date/nav); panels with subtle glass + separators

2) Home (Recommendation hero) [ ]
- Hero card with left accent, badges (Combined/Suppressed), confidence bar
- “Today” micro tiles (VIX, USD, RSI, Corr) with sparklines

3) PriceChart polish [ ]
- Dark grid; crosshair tooltip; volume pane; range buttons (1M/3M/1Y/ALL)

4) Explainer [ ]
- Driver chips (ToggleGroup); impact dots; “What changed” timeline style

5) Backtests [ ]
- KPI tiles with icons; gradient equity area; heatmap via ECharts

6) Learn [ ]
- Chip motion; improved Today callouts; term sparklines

7) Status [ ]
- Payload ring and file meters; stale badge styling

8) Micro-interactions & a11y/perf [ ]
- Framer Motion transitions; tooltip delays; skeletons; prefers-reduced-motion; bundle/code-split audit

## Notes
- Draw color inspiration from Awwwards/SiteInspire/Webflow showcases; emulate TradingView minimalism for charts.
