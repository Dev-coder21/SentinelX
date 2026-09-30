from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.api.health import router as health_router
from app.api.suppliers import router as suppliers_router
from app.api.network import router as network_router
from app.api.risk_events import router as risk_events_router
from app.api.dashboard import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch scheduler if configured
    if settings.ENABLE_SCHEDULER:
        start_scheduler()
    yield
    # Shutdown: cleanly terminate background threads
    shutdown_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SentinelX — Real-time Supply Chain Risk Intelligence & Constrained-Optimization Prioritization Engine",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS middleware for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-level endpoints (/health, /suppliers, /network, /risk-events, /dashboard)
app.include_router(health_router)
app.include_router(suppliers_router)
app.include_router(network_router)
app.include_router(risk_events_router)
app.include_router(dashboard_router)

# Versioned API endpoints (/api/v1/health, /api/v1/suppliers, /api/v1/network, /api/v1/risk-events, /api/v1/dashboard)
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(suppliers_router, prefix=settings.API_V1_STR)
app.include_router(network_router, prefix=settings.API_V1_STR)
app.include_router(risk_events_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
        "suppliers": "/suppliers",
        "network": "/network",
        "risk_events": "/risk-events",
        "dashboard_summary": "/dashboard/summary",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
