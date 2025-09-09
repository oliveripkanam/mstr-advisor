## Project Essay / Dissertation Plan

This outline is designed to help you write a rigorous, readable, and publication‑quality essay about the MSTR Advisor project. It balances engineering detail, methodology clarity, and personal reflection. Each section includes prompts and evidence to collect. Adapt length per your goals (blog post, report, dissertation).

### 1) Title Page
- Working title: “A Free‑First Advisor for MSTR: From Data Pipelines to Explainable Decisions”
- Your name, date, version
- Abstract (≤ 200 words): What you built, the approach, key results, and impact

### 2) Executive Summary (non‑technical) [0.5–1 page]
- What the project does in plain English
- Who benefits and how
- One diagram of the system at a glance (data → processing → outputs → website)
- Three most important outcomes (e.g., reliability, explainability, free access)

### 3) Introduction & Motivation [1–2 pages]
- Why this problem matters to you (free access, transparency, personal learning)
- Context: MSTR’s volatility, need for disciplined decision support
- Goals: daily recommendations; explainability; conservative, robust methods
- Scope: end‑to‑end system (data ingestion, rules, ML, CI/CD, static site)
- Non‑goals: not a trading bot, not personalized financial advice

### 4) Problem Statement and Objectives
- Problem framing: “Provide simple, daily, explainable guidance for MSTR.”
- Objectives:
  - Reliable ingestion and feature computation from public sources
  - Rule‑based baseline with rational guardrails
  - Lightweight ML for complementary signal blending
  - Backtesting to validate sanity (CAGR, MDD, Sharpe, hit‑rate)
  - Robust CI/CD and reproducibility; static export for free hosting
  - Clear public documentation and on‑site learnability

### 5) Related Work / Inspirations
- Public advisory dashboards, quant blogs, research on trend/RSI/volatility filters
- Lightweight forecasting methods vs. complex models
- Free/low‑friction publishing (GitHub Pages, static SPAs)
- Cite any posts, papers, repos that informed choices

### 6) System Architecture [Diagram + 1–2 pages]
- Diagram: data sources → backend pipeline (ingest → normalize → features → rules/ML → artifacts) → frontend (Next.js static) → hosting (GitHub Pages)
- Components and responsibilities:
  - Backend (Python, pandas, scikit‑learn)
  - Rules engine and safety rails
  - ML training (weekly), calibrated probabilities, blending
  - Artifacts (JSON) and status payload budgets
  - Frontend (Next.js 14, lightweight‑charts, Tailwind)
  - CI/CD (workflows, schedules, reproducibility)

### 7) Data & Features [1–2 pages]
- Symbols and sources (yfinance); validation steps
- Technical indicators: SMA/EMA, RSI, MACD, ATR, Bollinger Bands
- Cross‑asset context: VIX regime bands, USD trend (UUP), BTC correlation
- Labeling: 5‑day future returns (Up/Flat/Down)
- Handling missing data, JSON nulls (NaN → null)
- Payload budgets and artifact sizes (why and how enforced)

### 8) Baseline Rules & Explainability [1–2 pages]
- Philosophy: simple, auditable rules; clarity > complexity
- Core rules: Buy/Hold/Reduce based on trend, momentum, risk
- Safety rails: stale data guard, min confidence, VIX cap at 55%
- Explainability: narrative driver list, “what changed” deltas
- Backtest of rules alone; interpretation of metrics

### 9) Machine Learning Component [1–2 pages]
- Model: GradientBoostingClassifier with calibration (CalibratedClassifierCV)
- Feature set and label horizon rationale
- Training cadence (weekly) vs. daily inference budget
- Probabilities sanity checks, drift awareness
- Blending with baseline (conservative adjustments)
- Limitations: data regime shifts, small sample risks

### 10) Backtesting & Evaluation [1–2 pages]
- Metrics: CAGR, max drawdown, Sharpe, turnover, rolling hit‑rate
- Rolling/heatmap views and why they matter
- Sanity gates in CI (assertions on ranges)
- Interpret results: what’s “good enough” for an advisory dashboard

### 11) Frontend & UX [1–2 pages]
- Next.js static export; basePath issues on GitHub Pages and their fixes
- Lightweight Charts: candlesticks, volume, range buttons, URL‑sync
- RecommendationCard: baseline/combined toggle, probability bars
- Info & Methodology page: “Today” callouts, glossary, guidance
- Accessibility, responsiveness, and micro‑interactions

### 12) CI/CD, Reliability, and Reproducibility [1–2 pages]
- Workflows: daily baseline, weekly ML, integration, acceptance, Pages deploy
- Common failure modes fixed: YAML heredoc indentation, missing fi, 404s from paths
- Artifact validation and payload budget monitoring
- Determinism strategies, pinned deps, and frozen‑window ML regression

### 13) Risks, Ethics, and Disclaimers
- Not financial advice; signal uncertainty; responsible messaging
- Dataset biases, survivorship, parameter tuning risk
- Guardrails to avoid overconfidence (VIX caps, conservative blending)

### 14) Results & Discussion
- Summarize backtest metrics and qualitative behavior across regimes
- Examples of daily outputs and explanation snippets
- What worked well vs. what was fragile
- Impact of fixes (e.g., volume scale separation, JSON NaN handling)

### 15) Limitations
- Static data cadence; dependency on public APIs
- Single‑asset focus; label horizon choice; simple model class
- UI trade‑offs (static export vs. SSR; payload budgets)

### 16) Future Work
- Strategy: position sizing rules, stop/TP evolution, regime‑specific playbooks
- ML: feature importance tracking, time‑aware CV, class‑imbalance handling
- Data: alternative sources, intraday snapshots, additional context factors
- Product: mobile polish, onboarding tips, scenario explainers, alerts

### 17) Personal Reflection & Learning Outcomes
- What you learned technically (Python data stack, Next.js, CI/CD)
- Debugging lessons (workflows, 404s, basePath, chart scaling)
- Product thinking: free‑first design, clarity, and user trust
- If starting over: what you’d keep/change

### 18) Conclusion
- Re‑state the problem, approach, and contribution
- Why “free‑first” plus explainability matters
- One paragraph on the project’s significance and next steps

### 19) Reproducibility Checklist (Appendix)
- Environment: Python 3.11, Node 20; requirements.txt and package.json
- Data refresh: run normalization, features, cross‑asset, rules
- ML: weekly job; frozen‑window test; sanity gates
- Commands/workflows to run in order (document current versions)
- Artifacts expected in `data/public/`

### 20) Day‑by‑Day Build Mapping (Appendix)
- Map to `BUILD_PLAN.md` and `PROGRESS_LOG.md` (Days 1–7)
- For each day: goals, files touched, outputs generated, verification done
- Include screenshots or JSON excerpts as evidence

### 21) Glossary (Appendix)
- Keep in sync with `configs/glossary.yaml` and `configs/terminology.json`
- Provide plain‑English and quantitative guidance ranges

---

## Writing Prompts (per section)

- Executive Summary: “In one paragraph, how does the system help a retail user today?”
- Motivation: “What frustrated you about existing tools? Why free‑first?”
- Objectives: “Which decision risks is the system designed to reduce?”
- Architecture: “Draw the pipeline as boxes and arrows; label data contracts.”
- Features: “Which signals were most useful? Which were noisy?”
- Rules: “State rules as if‑then bullets; explain each safety rail.”
- ML: “Why calibrated probabilities? How are probabilities combined with rules?”
- Backtest: “What threshold distinguishes acceptable vs. risky drawdowns for you?”
- Frontend: “Which UI choices improved comprehension the most?”
- CI/CD: “Which single fix most improved reliability and why?”
- Risks/Ethics: “State your disclaimer and responsible‑use guidance.”
- Reflection: “What was your biggest surprise? What would you do differently?”

---

## Figures & Evidence To Include
- System architecture diagram
- Example daily recommendation JSON and rendered card
- Backtest equity curve, rolling Sharpe, drawdown, hit‑rate, monthly heatmap
- Screenshots of Info & Methodology page “Today” callouts
- CI/CD workflow diagram; snippet of a sanity gate assertion

---

## Exporting to PDF or DOCX (Windows‑friendly)

Option A: Use your browser’s Print to PDF on the GitHub viewer.

Option B: Pandoc (recommended for DOCX/PDF with TOC)

1) Install Pandoc and TeX (once):
   - Chocolatey (Admin PowerShell):
     - choco install pandoc -y
     - choco install miktex -y
2) From repo root, run:
   - pandoc docs/PROJECT_ESSAY.md -o docs/PROJECT_ESSAY.pdf --from gfm --toc --metadata title="MSTR Advisor"
   - pandoc docs/PROJECT_ESSAY.md -o docs/PROJECT_ESSAY.docx --from gfm --toc

Tip: After you complete this plan, copy it to `docs/PROJECT_ESSAY.md` and replace prompts with your content. Keep figures in `docs/assets/` and reference them with relative paths.

---

## Writing Checklist
- Clear non‑technical summary up front
- Diagrams for architecture and CI/CD
- Explicit rules and guardrails documented
- ML assumptions and calibration explained
- Backtest metrics and visualizations interpreted (not just shown)
- Risks, disclaimers, and ethics included
- Reproducibility instructions verifiable by a third party
- Personal reflection adds unique value


