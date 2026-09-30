# SentinelX 🛡️
### Real-Time Supply Chain Risk Intelligence & LP Prioritization Platform

SentinelX fuses live news, weather, and shipping signals into predictive per-supplier risk scores, visualizes multi-tier dependencies through an interactive force-directed network graph, and features a linear-programming constrained optimization engine (PuLP) that solves the knapsack-style resource allocation problem: answering, under strict recovery budget constraints, which disrupted suppliers or routes to act on first to protect the maximum business revenue.

> **Network Framing Note:**  
> The supplier network modeled in SentinelX represents a **hypothetical mid-size electronics manufacturer** comprising 15–30 Tier-1 and Tier-2 component suppliers distributed across critical global manufacturing corridors (East Asia, Southeast Asia, North America, Europe). Real-world regional risk signals (GDELT/NewsAPI, Open-Meteo) are mapped directly onto this realistic dependency graph.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite + TS)                   │
│   Network Graph View | Risk Radar | LP Prioritization Panel      │
└───────────────────────────┬─────────────────────────────────────┘
                             │ REST / JSON (FastAPI)
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend (Python 3.11+)               │
│   /suppliers  /risk-scores  /network  /prioritize  /health      │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
┌──────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼─────────────┐
│ News/Event  │ │  Weather     │ │  Risk      │ │  Optimization   │
│ NLP Pipeline│ │  Risk Fetcher│ │  Fusion    │ │  Engine (PuLP)  │
│ (Sentiment  │ │ (Open-Meteo) │ │  Scorer    │ │  Resource       │
│  + Gemini)  │ │              │ │            │ │  Allocation     │
└──────┬─────┘ └──────┬───────┘ └─────┬──────┘ └─────┬────────────┘
       │              │               │               │
       └──────────────┴───────┬───────┴───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PostgreSQL DB     │
                    │ suppliers, deps,     │
                    │ risk_events, scores, │
                    │ mitigation_plans     │
                    └─────────────────────┘
```

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, psycopg v3 / psycopg2-binary, Uvicorn, pytest.
- **Optimization**: PuLP (Linear Programming Knapsack solver).
- **NLP & LLM**: HuggingFace Transformers (CPU-optimized sentiment model), Google Gemini API (free tier via Google AI Studio for event classification).
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui foundation, Framer Motion, react-force-graph, Recharts, Lucide Icons.
- **Database & Infrastructure**: PostgreSQL 16, Docker, Docker Compose.

---

## 📋 Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
# Database Connection
DATABASE_URL=postgresql://sentinelx:sentinelx_password@localhost:5432/sentinelx_db

# Real-Time Ingestion APIs
NEWS_API_KEY=your_newsapi_or_gdelt_key
WEATHER_API_KEY=your_open_meteo_key

# LLM Provider (Google Gemini API via Google AI Studio)
LLM_PROVIDER=gemini
LLM_API_KEY=your_gemini_api_key

# Frontend Configuration
VITE_API_URL=http://localhost:8000
```

---

## 🚀 Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm
- Docker and Docker Compose (or local PostgreSQL)

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Run tests
pytest

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

Verify backend:
- Health check: `curl http://localhost:8000/health`
- Interactive OpenAPI docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Running with Docker Compose (Full Stack)

```bash
docker-compose up -d --build
```
- PostgreSQL: `localhost:5432`
- FastAPI Backend: `http://localhost:8000`
- React Frontend: `http://localhost:3000`

---

---

## 🧠 Risk Scoring & NLP Intelligence Engine (Phase 4)

SentinelX transforms unstructured news headlines and live weather anomalies into an explainable, normalized **0–100** supplier risk score.

### 1. Risk Pipeline Architecture
```
Unstructured Signals (GDELT / Open-Meteo)
                  ↓
   HuggingFace Sentiment Analyzer (CPU Singleton)
                  ↓
   Gemini Event Classification (Structured JSON)
   ↳ Fallback: Deterministic Keyword Rule Engine
                  ↓
   Event Severity Engine (0–100 Scale)
                  ↓
   Geographic Supplier-Region Association
                  ↓
   Multi-Event Risk Fusion (Diminishing Returns + Recency Decay)
                  ↓
   Supplier Criticality Multiplier (Exposure Amplification)
                  ↓
   Persisted Risk Scores & JSONB Contributing Factors
```

### 2. Mathematical Risk Fusion Formula
The risk of an individual event $i$ combines base severity, negative sentiment risk contribution, and physical weather risk:
$$R_i = \min(100.0, 0.45 \cdot \text{Severity}_i + 0.35 \cdot \text{SentimentRisk}_i + 0.20 \cdot \text{WeatherRisk}_i)$$

Where:
- $\text{SentimentRisk}_i = \max(0.0, -\text{SentimentScore}_i \times 100)$ (only negative sentiment contributes to risk; neutral or positive sentiment yields $0.0$).
- $\text{Severity}_i \in [0, 100]$ is determined by Gemini classification or category baseline.
- $\text{WeatherRisk}_i \in [0, 100]$ is derived from extreme meteorological anomalies (gale-force winds, typhoons, severe precipitation).

#### Recency Decay Weighting
Recent events bear substantially higher operational relevance than older events. Each event is weighted using exponential half-life decay:
$$w_{t,i} = e^{-\lambda \cdot \Delta t_i}, \quad \lambda = \frac{\ln(2)}{14} \approx 0.04951 \text{ days}^{-1}$$
*(14-day half-life: an event detected 14 days ago has its risk weight halved; events older than 45 days decay to near zero).*

#### Multiple Event Aggregation (Diminishing Marginal Risk)
Suppliers often face clusters of correlated news articles. Blindly summing event risks would cause artificial score explosions. SentinelX aggregates multiple events using a probabilistic diminishing returns formula:
$$R_{\text{agg}} = 100 \times \left(1 - \prod_{i=1}^{N} \left(1 - \frac{R_i \cdot w_{t,i}}{100}\right)\right)$$
This guarantees that 10 duplicate or concurrent reports cannot exceed the 100-point ceiling while ensuring that multiple independent severe disruptions compound realistically.

#### Criticality Multipliers (Exposure Amplification)
Supplier criticality tier magnifies business exposure, **without creating phantom risk out of nothing**:
$$M_{\text{tier}} = \begin{cases} 1.30 & \text{if Tier 1 (sole-source, custom silicon, ASICs)} \\ 1.15 & \text{if Tier 2 (critical passives, memory, displays)} \\ 1.00 & \text{if Tier 3 (standard commodities, connectors)} \end{cases}$$

$$\text{Final Risk Score} = \min(100.0, \text{round}(R_{\text{agg}} \times M_{\text{tier}}, 1))$$

> **Criticality Design Principle**: If a supplier has zero external risk signals ($R_{\text{agg}} = 0$), then $0 \times 1.30 = 0.0$. Being a critical Tier 1 partner does not make a supplier inherently risky; rather, external disruptions amplify their systemic threat to production.

### 3. Gemini & Deterministic Fallback Classification
- **Primary Classifier**: Uses Google Gemini API (`gemini-2.5-flash` via `google-genai` SDK) to categorize events into standard supply chain taxonomies (`factory_disruption`, `supply_shortage`, `logistics`, `weather`, `labor`, `geopolitical`, `other`) with structured JSON validation enforced via Pydantic.
- **Request Efficiency**: Evaluated events store their `classification_source` (`gemini`, `fallback`, `weather_detector`). Repeated pipeline runs bypass already-classified events, preventing unnecessary API quota consumption.
- **Deterministic Fallback Engine**: If Gemini is unreachable, rate-limited (HTTP 429), or outputs malformed text, SentinelX automatically engages a keyword-based fallback engine with domain precedence and category-specific severity baselines. The pipeline never crashes on external LLM failure.

### 4. Explainable Contributing Factors
Every persisted score includes a transparent JSONB payload:
```json
{
  "raw_risk": 45.2,
  "criticality_multiplier": 1.3,
  "news_risk": 42.0,
  "weather_risk": 0.0,
  "event_count": 2,
  "event_types": ["supply_shortage", "logistics"],
  "top_events": [
    {
      "headline": "Wafer fabrication facility encounters packaging delay",
      "severity": 65.0,
      "sentiment_score": -0.72,
      "detected_at": "2026-09-28T10:00:00Z"
    }
  ]
}
```

### 5. Risk Model Limitations & Disclaimer
> [!IMPORTANT]
> **Engineering Risk Model Disclaimer**: The risk scoring engine implemented in SentinelX is an **operational and supply chain engineering risk index** designed to prioritize attention and guide constrained linear-programming mitigations. It is **not** a scientifically calibrated econometric forecast or certified financial risk model. Scores reflect regional and event-based heuristics rather than balance-sheet credit solvency.

---

## ⏱️ Scheduled Risk Refresh & Historical Tracking (Phase 5)

SentinelX features an automated orchestration lifecycle to continuously ingest, classify, fuse, and persist supplier risk snapshots without manual intervention or heavy messaging infrastructure.

### 1. Unified Orchestration Workflow
The unified pipeline (`refresh_risk_pipeline`) executes a four-stage process:
1. **Signal Ingestion**: Ingests fresh news and meteorological events across active supplier regions.
2. **NLP Classification**: Analyzes sentiment and classifies newly arrived, unclassified events via Gemini (or deterministic fallback).
3. **Multi-Event Risk Fusion**: Evaluates geographic recency, compounding effects, and criticality multipliers per supplier.
4. **Historical Persistence**: Stores timestamped snapshots in `risk_scores` while preserving complete audit history.

### 2. Lightweight Scheduling with APScheduler
SentinelX utilizes **APScheduler** (`BackgroundScheduler`) embedded within FastAPI's `lifespan` handler:
- Configurable interval: `RISK_REFRESH_INTERVAL_MINUTES=60` (default 60 minutes).
- Guarded activation: `ENABLE_SCHEDULER=False` by default to prevent background threads during test execution or module imports.
- Zero external infrastructure: avoids Celery, Redis, or Kafka overhead for single-node deployments.

### 3. Failure Isolation & Idempotency
- **Provider Resilience**: If GDELT or Open-Meteo experiences timeouts or rate limits, the unaffected provider continues, unclassified events are processed, and suppliers are safely rescored.
- **Deduplication**: Ingested articles are fingerprinted with SHA-256 hashes to prevent duplicate database rows.
- **Quota Efficiency**: Events record `classification_source` upon evaluation; subsequent refresh ticks bypass already-classified events, eliminating unnecessary Gemini API consumption.

### 4. Executive Dashboard Summary API
- `GET /dashboard/summary` (and `/api/v1/dashboard/summary`): Computes aggregated fleet metrics in a single joined subquery without N+1 query bottlenecks:
  - Total supplier count & fleet average risk score (0–100)
  - Risk tier distribution (`high_risk_supplier_count`, `medium_risk_supplier_count`, `low_risk_supplier_count`)
  - Highest-risk supplier entity and score
  - Active-window (last 14 days) external disruption count
  - Criticality tier distribution

---

## 🎯 Constrained Optimization & Mitigation Prioritization (Phase 6)

SentinelX formulates supply chain risk mitigation as a **0-1 Knapsack Binary Integer Linear Program** solved via **PuLP (CBC solver)**:

> *"Given a limited capital mitigation budget $B$, which at-risk suppliers should be prioritized for action to maximize expected protected business revenue?"*

### 1. Mathematical Formulation

#### Decision Variables
For each eligible candidate supplier $i \in \{1, \dots, N\}$:
$$x_i \in \{0, 1\}$$
where $x_i = 1$ denotes selecting supplier $i$ for capital risk mitigation (e.g. qualifying secondary tooling, reserving dual-source buffer wafer stock, or chartering dedicated expedited air freight).

#### Objective Function
Maximize total expected protected revenue across the manufacturing network:
$$\text{Maximize } Z = \sum_{i=1}^{N} \text{ProtectedRevenue}_i \cdot x_i$$

#### Budget Constraint
The total expenditure across selected mitigations cannot exceed the allocated budget $B$:
$$\sum_{i=1}^{N} \text{Cost}_i \cdot x_i \le B$$

### 2. Economic Factor Derivations

The optimization model deterministically evaluates four core economic parameters for each supplier:

1. **Dependency Impact Factor ($\text{Impact}_i$)**:
   $$\text{Impact}_i = \max\left(1.0, \sum_{d \in D_i} \text{weight}_d\right)$$
   Measures downstream operational breadth based on the number and critical weights of product lines (e.g. Flagship Smartphone, Wearables) that rely on supplier $i$.

2. **Gross Risk Financial Exposure ($\text{Exposure}_i$)**:
   $$\text{Exposure}_i = \left(\frac{\text{RiskScore}_i}{100.0}\right) \times \text{Impact}_i \times \text{AnnualSpend}_i$$
   Combines live normalized risk ($0-100$), multi-product dependency leverage, and procurement spend.

3. **Expected Protected Revenue ($\text{ProtectedRevenue}_i$)**:
   $$\text{ProtectedRevenue}_i = \text{Exposure}_i \times \text{Effectiveness}_i$$
   Where $\text{Effectiveness}_i \in [0.75, 0.85]$ is the deterministic risk reduction achieved through technical mitigation (e.g. 75% for custom silicon, 85% for standard passives).

4. **Mitigation Cost ($\text{Cost}_i$)**:
   $$\text{Cost}_i = \text{BaseCost}(\text{Tier}_i) + \text{Rate}(\text{Tier}_i) \times \text{AnnualSpend}_i$$
   - **Tier 1**: $\$75,000 + 4\%$ annual spend (complex ASICs, masks, foundry reservation)
   - **Tier 2**: $\$40,000 + 3\%$ annual spend (sensors, displays, batteries)
   - **Tier 3**: $\$20,000 + 2\%$ annual spend (standard passives, packaging)

### 3. Explainable Rationale & Auditability
Every selected supplier output includes an explicit, deterministic justification citing exact metrics and ROI efficiency multiple ($\text{Efficiency} = \frac{\text{ProtectedRevenue}}{\text{Cost}}$):
> *"Prioritized due to critical evaluated risk (85.0/100) and Tier 1 standing across 3.0x dependency impact, protecting an estimated $7,458,750 in exposed revenue for $335,000 cost (22.3x efficiency ROI)."*

Every optimization run is persisted to `mitigation_plans` with full budget utilization, remaining capital, and auditable metadata, retrievable via `GET /mitigation-plans/latest`.

---

## 📍 Current Development Status

- [x] **Phase 1: Foundation & Architecture (COMPLETE)**
  - Repository structure, Docker Compose, PostgreSQL schema models (suppliers, dependencies, risk_events, risk_scores, mitigation_plans).
  - Alembic migration system configured and verified.
  - FastAPI application entrypoint with CORS, config settings, and GET `/health` endpoint.
  - React + Vite + TypeScript frontend shell configured with Tailwind CSS, shadcn/ui foundation, and live health probing.
  - Automated test suite for backend routes and ORM schemas.
- [x] **Phase 2: Supplier Network & Graph Modeling (COMPLETE)**
  - 24 deterministic suppliers, 44 directed dependencies, 4 product hubs.
  - Idempotent seeding mechanism with category and criticality tiers.
  - REST API endpoints for suppliers, supplier detail, and network topology.
- [x] **Phase 3: Real-Time Risk Signal Ingestion (COMPLETE)**
  - Live GDELT news ingestion and Open-Meteo extreme weather detection.
  - Exponential backoff retry client, local in-memory TTL caching, and SHA-256 fingerprint deduplication.
  - Provider failure isolation and `/risk-events` query endpoint with filtering.
- [x] **Phase 4: NLP Event Intelligence & Supplier Risk Fusion (COMPLETE)**
  - CPU-optimized HuggingFace SST-2 sentiment analyzer singleton with lexical fallback.
  - Structured Gemini API event classification with deterministic keyword fallback.
  - Mathematical risk fusion formula with recency decay, multi-event compounding, and criticality exposure amplification.
  - Persistent explainable `risk_scores` with JSONB contributing factors and trend tracking.
- [x] **Phase 5: Scheduled Risk Refresh & Historical Tracking (COMPLETE)**
  - Unified orchestration workflow `refresh_risk_pipeline()` with failure isolation.
  - Manual execution job `python -m app.jobs.refresh_risk` with concise status logging.
  - Configurable APScheduler lifecycle integrated via FastAPI lifespan.
  - Snapshot persistence preserving historical risk trajectories without duplicate events.
  - High-performance `GET /dashboard/summary` endpoint for executive KPI cards.
- [x] **Phase 6: Constrained Optimization & Mitigation Prioritization (COMPLETE)**
  - 0-1 Knapsack binary linear programming engine using PuLP (CBC solver).
  - Deterministic derivation of mitigation costs, risk exposure, and expected protected revenue.
  - Human-readable ROI rationale generated for every prioritized supplier.
  - Endpoints `POST /prioritize` and `GET /mitigation-plans/latest` with full audit persistence.
- [x] **Phase 7: Production Dashboard Aggregation API (COMPLETE)**
  - High-performance, constant-query ($O(1)$, zero N+1) aggregation service for executive dashboard command center.
  - Aggregated endpoints: `GET /dashboard/summary` and `GET /api/v1/dashboard/summary`.
  - Metrics: Overview KPIs (suppliers, avg risk, high/medium/low counts, highest risk supplier), Risk Distribution (LOW, MEDIUM, HIGH, CRITICAL), Regional Risk summaries, chronological Risk Trend history (Recharts-ready), Event Type Distribution (14-day window), Recent Events with correlated affected suppliers, and latest persisted Mitigation Plan.
  - Real database queries only with graceful handling for partial/empty data states.
  - 86 comprehensive backend tests passing.
- [x] **Phase 8: Frontend Application Core (COMPLETE)**
  - Modular React 19 + TypeScript + Vite + Tailwind CSS application shell and client-side routing.
  - Centralized API client with normalized error handling, timeout abort, and environment-configurable base URL.
  - Strongly typed API interfaces matching all FastAPI backend models.
  - Complete operational views: Dashboard with Recharts telemetry (risk distribution, regional concentration, historical trend), Supplier Directory with search and corridor/tier filters, Supplier Detail with risk trajectory and explainable contributing factors, Risk Events Feed with corridor/source filtering, Network Page foundation, and Mitigation Prioritization workspace.
  - Zero mock data; connected directly to live backend endpoints.
- [x] **Phase 9: Signature Interactive Supplier Dependency Network (COMPLETE)**
  - Responsive 2D force-directed canvas (`react-force-graph`) powered strictly by real `GET /network` topology (24 component suppliers + 4 product-line assembly hubs + 44 directed dependencies).
  - Clear visual and geometric differentiation between product hubs (octagonal/square indigo nodes) and component suppliers (circular nodes sized by criticality tier and colored by deterministic risk bracket).
  - Subtle active risk pulse on High ($\ge 70$) and Critical ($\ge 80$) suppliers respecting `prefers-reduced-motion`.
  - Dependency edge thickness scaled deterministically by `dependency_weight` with directional orientation toward product sinks.
  - $O(1)$ hover highlight isolating 1st-degree neighbor clusters and dimming unrelated topology.
  - Contextual slide-out node inspection panel with direct navigation to deep-dive supplier telemetry.
  - Compact multi-axis filtering (risk bracket, operating corridor, criticality tier, product hub toggle) and keyboard-accessible node selector.
  - Camera control toolbar (Zoom In, Zoom Out, Zoom to Fit, Center Selected Node) and compact visual legend.
  - Zero mock data; 100% clean TypeScript build and lint.
- [x] **Phase 10: Optimization Decision Experience (COMPLETE)**
  - Full operational decision-support workspace turning capital recovery constraints into prioritized mitigation actions.
  - Interactive capital budget input with validation, preset quick-buttons, and real-time execution via `POST /prioritize`.
  - Prominent animated expected protected revenue counter and PuLP objective value matching exact solver output.
  - Animated budget utilization bar (Framer Motion) displaying allocated capital vs. remaining cushion with sub-second settling.
  - Distinct operational banners distinguishing between `LATEST PERSISTED PLAN` (from `GET /mitigation-plans/latest`) and `NEW OPTIMIZATION RESULT`.
  - Rich action cards communicating complete decision rationale: Risk status → Mitigation Cost → Protected Revenue → Value-Efficiency ROI multiple (`Protected Revenue / Cost`) → Deterministic Rationale.
  - Meaningful zero-selection outcome state for insufficient budgets without application error.
  - Direct workflow navigation: "Inspect in Network" deep-links directly to `/network?select=${supplier_id}` auto-focusing the node on the 2D dependency graph; "Telemetry Detail" links to `/suppliers/${id}`.
- [x] **Phase 11: Risk Intelligence UI (COMPLETE)**
  - Cohesive, information-rich risk intelligence user experience across Dashboard, Supplier Directory, Supplier Detail, and Risk Events Feed.
  - Centralized risk taxonomy in `src/lib/risk.ts` enforcing strict SentinelX thresholds: LOW (< 40), MEDIUM (40–69.9), HIGH (70–79.9), CRITICAL (≥ 80) with consistent colors.
  - Dashboard: 5-column fleet KPI grid with direct filter links, chronological historical trend with dual indicators (Avg Fleet Risk + High-Risk Supplier Count), clickable regional risk rows with direct corridor drill-down, and interactive risk tier distribution with count & percentage badges.
  - Supplier Directory: URL search parameters (`?region=...`, `?risk=...`, `?tier=...`, `?search=...`) for instant deep-linking, multi-axis filtering, and per-supplier "Inspect in Network" shortcut.
  - Supplier Detail: Deepest investigation surface featuring explainable mathematical decomposition (`raw_risk` × `tier_multiplier` → `final_score`), news vs. weather signal attribution bars, classified disruption badges, top contributing real-world signals, and product dependencies.
  - Risk Events Feed: Unified multi-axis investigation feed supporting corridor, source, disruption type, and severity filtering, with corridor-to-supplier cross-page navigation.
  - Zero mock data; 100% real API integration, 0 oxlint warnings, clean Vite production build, and 86/86 backend pytest passing.
- [x] **Phase 12: Final Design System & Visual Identity Implementation (COMPLETE)**
  - Comprehensive production design system establishing SentinelX as a Premium Dark Supply-Chain Intelligence Platform.
  - Centralized design tokens in `src/lib/tokens.ts`: 4-tier surface elevation system (Canvas `#080E1C`, Level 1 Operational Surface `#0D1628`, Level 2 Elevated Surface `#121D34`, Level 3 Active Surface `#172644`), standard borders (`#16233B`, `#1E2E4E`, `#283E66`), and centralized `CHART_THEME`.
  - Rigorous typography hierarchy using Google Fonts (Inter sans-serif for clean hierarchy, JetBrains Mono for telemetry, IDs, timestamps, and currency).
  - Standardized AppShell and Navbar (compact 56px command header, geometric shield identity, active navigation pill with teal `#3DD6C4` accent, live backend status indicator, and mobile responsive drawer).
  - Overhauled Dashboard, Network, Supplier Directory, Supplier Detail, Risk Events, and Prioritization pages with zero generic AI tropes (no glowing neon blobs, no purple gradients, no fake terminal text, no marketing bento cards).
  - All Recharts data visualizations standardized with centralized grid, axis, and tooltip themes.
  - 100% real API data preserved; 0 lint errors, clean TypeScript build, and 86/86 backend tests passing.
- [x] **Phase 13: Signature Motion & Interaction System (COMPLETE)**
  - Purposeful, operational motion architecture communicating state, change, causality, hierarchy, and focus (150–250ms timings).
  - Centralized motion tokens and transition presets in `src/lib/motion.ts` and `src/hooks/usePrefersReducedMotion.ts`.
  - Global route transitions: subtle 200ms opacity + 4px micro-translation in `AppShell.tsx`, with immediate zero-duration change when reduced motion is preferred.
  - Navbar: Controlled mobile drawer slide-down/fade via `AnimatePresence`, active link transitions, and active-scale feedback.
  - Dashboard KPI Motion: Reusable `<AnimatedNumber />` component smoothly interpolating metrics (total suppliers, average risk, high/med/low counts, protected revenue) using cubic ease-out, settling instantly when reduced motion is enabled.
  - Recharts motion: synchronized `isAnimationActive={!reducedMotion}` with 250ms reveal across Area, Line, and Bar charts.
  - Risk-state indicators: restrained ping dot on Critical risk nodes/badges and rings on High risk nodes, automatically disabled under `prefers-reduced-motion`.
  - Network Graph: Smooth node hover/selection highlighting, 450ms animated camera centering, and slide-in/fade inspection panel via `AnimatePresence`.
  - Supplier Detail: Animated mathematical risk decomposition values, smoothly transitioning telemetry bars, and chart reveal.
  - Risk Events Feed: Controlled 180ms entrance transitions for loaded signals, and restrained severity borders for High/Critical events.
  - Prioritization Workspace: Real-time PuLP solver execution states, 220ms budget utilization progress bar, animated protected revenue currency counter, and top priority visual emphasis.
  - Global accessible reduced-motion reset in `index.css` neutralizing CSS animations and transitions for users requesting reduced motion.
  - Zero mock data; 100% real API integration, 0 oxlint warnings, clean Vite production build, and 86/86 backend pytest passing.
- [ ] **Phase 14: Production UX & Accessibility Audit (Next)**
  - Comprehensive accessibility compliance (WCAG 2.1 AA), keyboard navigation flow, ARIA attributes, color contrast verification, and responsive UX hardening.


