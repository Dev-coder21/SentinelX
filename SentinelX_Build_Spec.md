# MASTER BUILD SPECIFICATION — SentinelX

A real-time supply chain risk intelligence platform combining risk signal fusion, network visualization, and constrained-optimization prioritization. This document is written to be handed directly to an AI coding assistant (Claude Code, Cursor, etc.) as a complete build brief.

---

## 0. Your Exact Environment Setup (MacBook Air M1 · ChatGPT Plus · Antigravity Pro)

**Read this before anything else — it prevents the two most likely early interruptions.**

**LLM API — critical correction:** ChatGPT Plus (chat.openai.com subscription) does **not** include API access. SentinelX's backend needs to call an LLM programmatically at runtime for event classification (Section 7) — this requires a real API key billed separately from ChatGPT Plus. Similarly, Antigravity Pro is your IDE's own coding-assistant quota; your *deployed app* cannot call through it.

**Recommended fix:** use the **Gemini API free tier** (via Google AI Studio — aistudio.google.com, same Google account you likely already use for Antigravity) for the event-classification LLM calls instead of OpenAI. It's free at low volume, requires no new billing relationship, and keeps you inside the Google ecosystem you're already in. Set `LLM_API_KEY` and `LLM_PROVIDER=gemini` in your `.env`. If you'd rather use OpenAI instead, you'll need to separately create billing at platform.openai.com — ChatGPT Plus won't cover it.

**Apple Silicon (M1) specifics:**
- Install **Docker Desktop for Apple Silicon** (arm64 native build) — do not use the Intel build under Rosetta, it's noticeably slower and occasionally flaky with Postgres volumes.
- All core dependencies here (FastAPI, Postgres, PuLP, OR-Tools, HuggingFace Transformers) have native arm64 wheels — no Rosetta needed. If `pip install` ever fails on a package with no arm64 wheel, that's your signal something's wrong (it should not happen with this stack).
- Keep the HuggingFace sentiment model **small** (e.g. `distilbert-base-uncased-finetuned-sst-2-english` or similar, not a multi-GB model) — you're running CPU inference on a laptop, not a GPU server. This is more than sufficient for the task and keeps memory sane.
- If your MacBook Air is the 8GB RAM variant, don't run the full Docker Compose stack (Postgres + backend + frontend) simultaneously with heavy Chrome/IDE usage — close other memory-heavy apps when running `docker-compose up`, or the Postgres container can get OOM-killed silently.
- Homebrew (`brew install postgresql` if you want a native Postgres for quick local testing outside Docker) is arm64-native and fine to use.

**Antigravity project setup for this environment:**
- Node.js: install via `brew install node` (get an LTS version, 20.x or later) for the React frontend.
- Python: use `python3` (3.11+, `brew install python@3.11` if needed) with a virtual environment (`python3 -m venv venv`) — never install packages globally.
- Follow the `PROJECT_SPEC.md` + `GEMINI.md` + `AGENT.md` setup from earlier in this project's planning to give Antigravity persistent context, and add the corrected LLM provider note (Gemini, not OpenAI/ChatGPT) into `GEMINI.md` so the agent doesn't default to writing OpenAI client code.

---

## 1. Elevator Pitch
SentinelX fuses live news, weather, and shipping/port signals into a risk score for a company's supplier network, visualizes dependencies as an interactive network graph, and — the key differentiator — includes a constrained-optimization prioritization engine that answers "given limited recovery/mitigation resources, which disrupted suppliers or routes should we act on first to protect the most revenue."

## 2. Why This Project (business framing)
Supply chain risk became a boardroom-level concern after COVID-19 and repeated geopolitical/climate disruptions (Suez blockage, port strikes, extreme weather). Companies pay for exactly this kind of early-warning + prioritization tooling. Unlike a pure anomaly-flagging tool, SentinelX goes from "here's what's risky" to "here's what to do about it given limited resources" — a prescriptive, not just predictive, capability.

## 3. Core Modules (build in this priority order)
1. **Risk Signal Ingestion** (news + weather + shipping/port data) — CRITICAL
2. **NLP Risk Scoring** (sentiment/event extraction from news per region/supplier) — CRITICAL
3. **Supplier Network Graph** (dependency modeling + visualization) — CRITICAL
4. **Prioritization/Optimization Engine** (LP-based resource allocation) — CRITICAL, this is the differentiator
5. **Dashboard / Frontend** — CRITICAL
6. **Historical trend tracking & alerting** — Important
7. **Auth, monitoring, full CI/CD** — Nice-to-have

## 4. Data Sources (real, free, public)
- **NewsAPI.org or GDELT Project** — free tier news data for event/sentiment extraction by region/topic (GDELT is especially strong for geopolitical event data and is completely free)
- **Open-Meteo API or NOAA** — free weather data (storms, extreme weather events) by region
- **MarineTraffic free tier / UN Comtrade / World Bank Logistics Performance Index** — shipping/port/trade data (use whichever has accessible free access at build time; UN Comtrade and World Bank data are reliably open)
- **Legal note:** use official APIs within their free-tier terms of service rather than scraping sites that prohibit it — this matters both practically (avoids getting blocked) and as a professionalism signal.
- **Note on the supplier network:** Since you won't have a real company's actual supplier list, construct a realistic hypothetical company (e.g., "a mid-size electronics manufacturer") with a defined network of 15-30 suppliers across regions, and map real regional risk signals onto that hypothetical network. **State this framing explicitly in your README.**

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                     │
│  Network Graph View | Risk Dashboard | Supplier Detail |          │
│  Prioritization Panel                                             │
└───────────────────────────┬───────────────────────────────────────┘
                             │ REST/WebSocket
┌───────────────────────────▼───────────────────────────────────────┐
│                      FastAPI Backend (Python)                      │
│  /suppliers  /risk-scores  /network  /prioritize  /events          │
└──────┬──────────────┬──────────────┬──────────────┬───────────────┘
       │              │              │              │
┌──────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────┐
│ News/Event  │ │  Weather     │ │  Risk      │ │  Optimization Engine │
│ NLP Pipeline│ │  Risk Fetcher│ │  Fusion    │ │  (PuLP/OR-Tools LP)  │
│(sentiment + │ │              │ │  Scorer    │ │  resource allocation  │
│ event tags) │ │              │ │            │ │  under budget         │
└──────┬─────┘ └──────┬───────┘ └─────┬──────┘ └─────┬─────────────────┘
       │              │               │               │
       └──────────────┴───────┬───────┴───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PostgreSQL DB       │
                    │ suppliers, dependencies│
                    │ risk_events, risk_scores│
                    │ mitigation_plans        │
                    └──────────┬─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Background Workers   │
                    │ scheduled news/weather │
                    │ polling + rescoring    │
                    └───────────────────────┘

Deployment: Docker Compose locally → Frontend on Vercel/Netlify,
Backend + workers on Render/Railway, DB on Supabase/Neon (managed Postgres)
```

## 6. Database Schema (PostgreSQL)

```sql
suppliers (
  id UUID PK, name, region, country, category,
  annual_spend FLOAT, criticality_tier INT
)

dependencies (
  id UUID PK, company_product VARCHAR, supplier_id FK,
  dependency_weight FLOAT  -- how critical this supplier is to that product line
)

risk_events (
  id UUID PK, region, source ENUM(news/weather/shipping),
  headline, summary, sentiment_score FLOAT, event_type VARCHAR,
  detected_at, raw_url
)

risk_scores (
  id UUID PK, supplier_id FK, timestamp,
  risk_score FLOAT (0-100), contributing_factors JSONB
)

mitigation_plans (
  id UUID PK, generated_at, budget_constraint FLOAT,
  selected_suppliers JSONB, expected_revenue_protected FLOAT,
  optimization_notes TEXT
)
```

## 7. NLP + Optimization Pipeline Detail

**News/Event Risk Scoring:**
- Pull news per supplier region (keyword: region name + terms like "port," "strike," "flood," "factory," "shortage")
- Sentiment scoring: use a pretrained transformer (e.g., a HuggingFace sentiment/finance-news model) rather than building your own from scratch — the value here is the pipeline and fusion, not reinventing sentiment analysis
- Event tagging: simple keyword/LLM-based classification into event types (weather, labor, geopolitical, logistics)
- Aggregate into a per-supplier-per-week risk contribution

**Weather Risk:**
- Pull extreme weather alerts/forecasts for each supplier's region, convert into a normalized risk contribution

**Risk Fusion:**
- `risk_score = f(news_sentiment_risk, weather_risk, event_severity, criticality_tier)` — document your weighting logic clearly, this is a real interview talking point
- **Evaluation approach:** since there's no clean ground-truth "was this supplier actually disrupted" label, validate by backtesting against known historical disruptions (e.g., does your pipeline correctly spike risk for a region during a real documented event, such as a known port closure or storm) — document this as your evaluation method in the README.

**Prioritization / Optimization Engine (the centerpiece):**
- Formulate as a knapsack-style constrained optimization: given a limited mitigation budget (money, or number of alternate-sourcing actions you can take this month), and each at-risk supplier's `risk_score × dependency_weight × annual_spend` as its "value," select the subset of suppliers to act on that maximizes protected revenue subject to the budget constraint
- Implement with **PuLP** or **Google OR-Tools** (both free, well-documented Python LP libraries)
- Output: a ranked, budget-respecting action list saved to `mitigation_plans`, with the LP's reasoning surfaced in the UI ("selected because: high risk score + high revenue dependency + within budget")

## 8. API Endpoints (FastAPI)
```
GET  /suppliers                     list all suppliers + current risk
GET  /suppliers/{id}                supplier detail + risk history + events
GET  /network                       full dependency graph (nodes + edges)
GET  /risk-events                   recent news/weather events, filterable by region
POST /prioritize                    { budget } -> optimized mitigation plan
GET  /mitigation-plans/latest       most recent optimization result
GET  /dashboard/summary             fleet-wide risk overview
```
Full request/response JSON schemas are left for the AI coding assistant to draft per-endpoint (standard REST conventions, paginated with `limit`/`offset`, ISO 8601 timestamps) — specify these as you implement each route rather than pre-locking them here.

## 9. Frontend Design System — make it look "dope"

**Visual direction:** Global command-center / geopolitical risk terminal aesthetic — think a fusion of a trading terminal and a network intelligence tool.

- **Palette:** deep navy/near-black base (#0B1120), warning gradient from amber to red for risk (#FFB020 → #FF3D3D), cool blue-green (#3DD6C4) for "safe/low risk," a distinct violet (#8B7CFF) for the optimization/prioritization panel to set it apart as "the AI decided this"
- **Typography:** technical sans (Space Grotesk or IBM Plex Sans), large confident numerals for risk scores and $ revenue-protected figures
- **Signature visual moment:** an **interactive force-directed network graph** (using `react-force-graph` or `d3-force`) where supplier nodes pulse and shift color in real time as risk changes, with edge thickness representing dependency weight — this is your single most important visual, it should be the centerpiece of the whole app and your demo
- **Prioritization panel:** present the optimizer's output as a ranked list with an animated "budget bar" that fills as you toggle suppliers, and a live-updating "revenue protected" counter that counts up with a spring animation as the plan is generated — this makes the optimization feel tangible and immediate rather than abstract math
- **Map view (optional but strong):** a world/regional map (Mapbox or deck.gl) showing supplier locations color-coded by risk, as an alternate view to the network graph

**Animation stack:**
- **Framer Motion** for all UI transitions, the animated budget bar, counters, panel slide-ins
- **react-force-graph or d3-force + Framer Motion overlay** for the network graph physics and node pulse/glow on risk change
- **GSAP** for the risk-score counter animations and any scroll-driven landing page
- Micro-interactions: hovering a supplier node should highlight its full dependency chain (connected edges glow, unrelated nodes dim) — genuinely impressive in a live demo and not hard to implement with `react-force-graph`'s built-in hover callbacks
- Keep it fast and purposeful (150–300ms transitions), avoid decorative animation that doesn't communicate risk or state change

**Component approach:** Tailwind CSS + shadcn/ui base, Framer Motion for interaction layer, react-force-graph (or d3-force directly) for the graph centerpiece.

## 10. Tech Stack Summary
- Frontend: React (Vite) + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, react-force-graph, Recharts
- Backend: FastAPI (Python 3.11+), Pydantic v2
- DB: PostgreSQL (Supabase or Neon)
- NLP: HuggingFace Transformers (small pretrained sentiment model, CPU inference) for sentiment scoring, plus the Gemini API (free tier) for event-type classification
- Optimization: PuLP or Google OR-Tools
- Background jobs: APScheduler
- Deployment: Docker + docker-compose locally; Render/Railway backend, Vercel/Netlify frontend
- Testing: pytest, Vitest/React Testing Library

## 11. Week-by-Week Roadmap (3-4 weeks — this should move faster than a first build since patterns are reused)

**Week 1 — Data & Backend Foundation**
- Define your hypothetical company + 15-30 supplier network with realistic regions/categories/dependency weights
- Set up Docker Compose, Postgres schema, ingestion jobs for GDELT/NewsAPI + Open-Meteo
- Build core CRUD endpoints for suppliers/dependencies
- *Done when:* you can hit `/suppliers` and `/network` against real seeded data and get correct responses.

**Week 2 — Risk Scoring Pipeline**
- Build sentiment/event extraction pipeline, validate on real recent events (does it actually flag real disruptions correctly?)
- Build risk fusion scorer, populate `risk_scores` table via scheduled job
- Start the network graph data structure (nodes/edges from `dependencies`)
- *Done when:* the pipeline correctly spikes risk scores for at least 2-3 real, documented historical disruption events you test it against.

**Week 3 — Optimization Engine + Frontend Core**
- Implement the LP-based prioritization engine with PuLP/OR-Tools, test with varied budget constraints, sanity-check outputs
- Build React app shell, network graph view, wire to real API
- Implement the animated budget bar + revenue-protected counter
- *Done when:* the optimizer returns different, sensible allocations as you vary the budget input, and the graph renders live data end to end.

**Week 4 — Polish, Map View, Deploy**
- Add map view (optional stretch) or spend time polishing the graph interactions (hover highlighting, node pulse)
- Full animation pass, responsive check
- Docker deploy to cloud, write README (explicitly note the hypothetical-company framing), record a 2-minute demo video
- *Done when:* the app is live at a public URL, works on mobile width, and a stranger could understand the README in under 3 minutes.

## 12. What Makes This "Next Level" If You Have Extra Time
- Add a time-slider on the network graph to replay how risk propagated over the last N weeks
- Add scenario simulation: "what if this supplier goes offline for 2 weeks" and show the cascading impact
- Add a second optimization mode: minimize total risk exposure instead of maximizing revenue protected, let the user toggle objective

## 13. Engineering Guardrails & Acceptance Criteria

**Auth:** Keep it simple — a single JWT-based auth flow (login/register, one user role) is enough. Don't build role-based access control or multi-tenancy; it adds real time cost for zero portfolio value here.

**Secrets/env management:** Use a `.env` file (gitignored) with `DATABASE_URL`, `NEWS_API_KEY`, `WEATHER_API_KEY`, and `LLM_API_KEY` (Gemini API key from Google AI Studio — see Section 0, not your ChatGPT Plus login); provide a `.env.example` in the repo so the AI assistant (and future you) knows exactly what's required to run it.

**API rate limits:** Free-tier news/weather APIs throttle aggressively. Build a simple retry-with-backoff and local caching layer around external calls early — this also protects you from burning through free-tier quotas during development, and is a legitimate "handling real-world API reliability" talking point.

**Cost reality check:** Expect small but real costs if you exceed free tiers on Render/Railway/Supabase after your project window, or if you use an LLM API for event classification at volume. Budget for this before you start, and mention in the README that this was a design consideration.

**Input validation:** Use Pydantic models strictly on all POST endpoints (especially `/prioritize`, which takes a budget input) — reject malformed input cleanly rather than letting it crash the service.

**Definition of done for the whole project:** deployed at a public URL, all 5 CRITICAL modules functioning end-to-end with real (or clearly-labeled simulated/hypothetical) data, README with architecture diagram + honesty notes + backtest validation notes, and a recorded demo video under 3 minutes.

---

## Resume Bullet (draft, refine after building)
"Built SentinelX, a supply chain risk intelligence platform that fuses real-time news, weather, and shipping signals into per-supplier risk scores visualized as an interactive dependency graph; implemented a linear-programming optimization engine (PuLP/OR-Tools) that generates budget-constrained supplier mitigation plans maximizing protected revenue."

## Repo Structure
```
sentinelx/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers
│   │   ├── models/         # SQLAlchemy models
│   │   ├── nlp/             # sentiment + event extraction pipeline
│   │   ├── optimization/    # PuLP/OR-Tools prioritization engine
│   │   ├── schemas/         # Pydantic schemas
│   │   └── core/            # config, db session
│   ├── notebooks/           # EDA, backtesting experiments
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   ├── tests/
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## How to Use This Document
Hand this to your AI coding assistant one module at a time, in the priority order from Section 3, following the Week-by-Week Roadmap. Don't ask it to build everything at once — feed it one module (e.g., "build the database schema and ingestion job from section 6") at a time, review its output, then move to the next. This keeps quality high and keeps you able to explain every part of the resulting codebase.
