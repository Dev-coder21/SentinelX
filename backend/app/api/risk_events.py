from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.risk_event import RiskEvent
from app.schemas.risk_event import RiskEventRead

router = APIRouter(prefix="/risk-events", tags=["Risk Events"])


@router.get("", response_model=List[RiskEventRead])
def list_risk_events(
    region: Optional[str] = Query(default=None, max_length=100, description="Filter events by geographic region"),
    source: Optional[str] = Query(default=None, max_length=50, description="Filter events by signal source ('news', 'weather', etc.)"),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of records to return"),
    offset: int = Query(default=0, ge=0, le=50000, description="Offset for pagination"),
    db: Session = Depends(get_db),
) -> List[RiskEventRead]:
    """
    List normalized risk events gathered across external signal providers (GDELT, Open-Meteo).
    Supports filtering by region and source with newest-first ordering.
    """
    query = db.query(RiskEvent)

    if region and region.strip():
        query = query.filter(RiskEvent.region == region.strip())

    if source and source.strip():
        query = query.filter(RiskEvent.source == source.strip())

    events = (
        query.order_by(RiskEvent.detected_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return events
