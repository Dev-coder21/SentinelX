# GEMINI.md — Instructions for AI Coding Sessions on SentinelX

## 1. Project Purpose
SentinelX is a real-time supply chain risk intelligence platform designed as a flagship portfolio project. It fuses live signals (news, weather, shipping) into per-supplier risk scores, visualizes dependencies across a supplier network graph, and features a linear-programming constrained optimization engine (the core differentiator) that prioritizes mitigation actions to maximize protected revenue under strict budget limits.

The supplier network models a **hypothetical mid-size electronics manufacturer** with 15–30 Tier-1 and Tier-2 suppliers mapped to real-world regional risk signals.

---

## 2. Architecture Overview
- **Backend**: FastAPI (Python 3.11+) structured into modular layers:
  - `app/api/`: REST routes (`/suppliers`, `/network`, `/risk-events`, `/prioritize`, `/dashboard/summary`, `/health`).
  - `app/models/`: SQLAlchemy 2.0 ORM models (`Supplier`, `Dependency`, `RiskEvent`, `RiskScore`, `MitigationPlan`).
  - `app/schemas/`: Pydantic v2 validation models.
  - `app/core/`: Configuration (`config.py`) and database session lifecycle (`database.py`).
  - `app/nlp/`: Sentiment scoring and event classification pipeline.
  - `app/optimization/`: PuLP-based linear programming resource allocation engine.
- **Frontend**: React + Vite + TypeScript command center:
  - `src/components/`: Reusable UI elements, network graph view, budget allocation sliders.
  - `src/pages/`: Command center views.
  - `src/lib/`: API clients, utilities (`cn` with `clsx` and `tailwind-merge`).
- **Database**: PostgreSQL with Alembic migration versioning.
- **Deployment**: Docker Compose locally; Render/Railway backend, Vercel/Netlify frontend.

---

## 3. Technology Stack & Strict Rules
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, psycopg v3 / psycopg2-binary, pytest.
- **Optimization**: PuLP / Google OR-Tools.
- **NLP**: HuggingFace Transformers (small CPU models like `distilbert-base-uncased-finetuned-sst-2-english`) + Gemini API.
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui foundation, Framer Motion, react-force-graph, Recharts.
- **LLM Provider (CRITICAL)**:
  - The runtime LLM provider is **STRICTLY Google Gemini API** (`LLM_PROVIDER=gemini`).
  - **NEVER** use OpenAI API or attempt to use ChatGPT Plus credentials as an API key. ChatGPT Plus is an interactive web subscription and does NOT provide API access.
  - Runtime API keys are configured via `LLM_API_KEY` obtained from Google AI Studio.

---

## 4. Development Principles & Guardrails
- **Preserve Existing Architecture**: Respect established patterns, file locations, and module boundaries.
- **Implement One Module at a Time**: Follow the week-by-week roadmap from `SentinelX_Build_Spec.md`. Never attempt to build the entire system in a single step.
- **Do Not Rewrite Working Modules**: Build additively; do not refactor or replace tested, functioning components unless explicitly directed.
- **Production-Oriented Simplicity**: Avoid over-abstraction, premature optimization, or unrequested auth layers.
- **Independent Runnability**: The FastAPI backend and React frontend must remain independently runnable for development and testing.
