## A Free‑First Advisor for MSTR

### Title, Author, Abstract

Title: A Free‑First Advisor for MSTR: Building an Explainable, Zero‑Cost Daily Signal

Author: Your Name

Abstract: I built a fully open, end‑to‑end advisor for MicroStrategy (MSTR) that produces a simple daily recommendation (Buy, Hold, or Reduce) with confidence and a plain‑English explanation. The system ingests public market data, computes a set of transparent features (trend, RSI, volatility, cross‑asset context), applies a conservative rule baseline, and blends it with a small, calibrated ML model trained weekly. All outputs are JSON artifacts, versioned in Git, and rendered on a static Next.js site hosted on GitHub Pages—so anyone can use it for free, without logins or paywalls. Along the way I had to solve practical problems: data cleanliness (NaN → null), pathing quirks on GitHub Pages, CI workflow hygiene, and the honest limits of signals in a noisy asset like MSTR. This write‑up captures the reasoning behind my choices, what worked and what didn’t, and why I believe “free‑first + explainable + disciplined” is a sane way to help retail investors navigate a volatile stock.

---

### Executive Summary

If you only read one section, read this:

- What it is: A daily, explainable MSTR advisor that says Buy/Hold/Reduce with a confidence bar and a short rationale.
- How it works: Public data → features (trend, RSI, VIX regime, USD trend, BTC correlation) → rules → (optionally) ML blend → JSON → static site.
- Why it exists: To make disciplined decisions accessible—free, transparent, and reproducible—no ads, no brokerage links.
- What I learned: Reliability beats cleverness. Clean workflows, stable paths, simple rules, and clear UI copy matter more than an exotic model.
- What the data says: The baseline rules are sensible; ML adds nuance but is capped during high‑vol regimes to avoid overconfidence.

---

### Introduction & Motivation

MSTR is a rollercoaster. It’s part software company, part Bitcoin proxy, and entirely capable of humbling anyone who trades it by vibe. I wanted something boring in the best way: a daily, repeatable process that nudges me toward good habits—cut the noise, check the trend, respect volatility, and size risk like an adult. Also, I wanted it to be genuinely free. That meant static hosting, portable JSON artifacts, and workflows I could inspect in public.

My constraints shaped the design. No heavy servers; just Python that writes JSON and a Next.js site that reads it. No magical black boxes; rules must be explainable, and ML must be calibrated, optional, and conservative. No “trust me”; show backtests, rolling stats, and a status page with data freshness and payload budgets. The result isn’t a trading bot or financial advice. It’s a calm daily brief—enough signal to act, enough context to doubt.

---

### Problem Statement and Objectives

Problem: Provide a simple, daily, explainable recommendation for MSTR that a normal person can understand and a skeptical engineer can reproduce.

Objectives:

- Reliability first: deterministic data pipeline, JSON outputs, CI gates, and payload budgets that keep Pages deploys sane.
- Transparent baseline: rule engine for Buy/Hold/Reduce with clear safety rails (stale‑data guard, min confidence, high‑VIX cap).
- Light ML, on a leash: weekly‑trained, calibrated probabilities blended conservatively with rules.
- Evidence, not vibes: backtests with CAGR, max drawdown, Sharpe, turnover, rolling hit‑rate, plus heatmaps for seasonality feel.
- Legible UI: a chart you can actually read, a card you can actually parse, and an Info page that explains every term with “Today” context.


