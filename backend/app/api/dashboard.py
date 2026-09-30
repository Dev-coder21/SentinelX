from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_summary(db: Session = Depends(get_db)) -> DashboardSummaryResponse:
    """
    Exposes high-level aggregated supply chain risk metrics for executive
    KPI cards and dashboard visualizers.
    """
    return get_dashboard_summary(db)
