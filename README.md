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

## 📍 Current Development Status

- [x] **Phase 1: Foundation & Architecture (COMPLETE)**
  - Repository structure, Docker Compose, PostgreSQL schema models (suppliers, dependencies, risk_events, risk_scores, mitigation_plans).
  - Alembic migration system configured and verified.
  - FastAPI application entrypoint with CORS, config settings, and GET `/health` endpoint.
  - React + Vite + TypeScript frontend shell configured with Tailwind CSS, shadcn/ui foundation, and live health probing.
  - Automated test suite for backend routes and ORM schemas.
- [ ] **Phase 2: Signal Ingestion & NLP Scoring**
  - Regional news and weather ingestion jobs.
  - HuggingFace transformer sentiment analysis + Gemini event classification.
- [ ] **Phase 3: Supplier Network Graph & LP Optimization Engine**
  - Network graph visualizer (`react-force-graph`).
  - Knapsack LP prioritization solver (PuLP) under budget constraints.
- [ ] **Phase 4: Dashboard Polish & Deployment**
  - Command center KPI counters, animated budget sliders, and public cloud deployment.
