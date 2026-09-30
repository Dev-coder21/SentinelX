from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.models.risk_score import RiskScore
from app.schemas.dashboard import DashboardSummaryResponse, HighestRiskSupplierSummary


def get_dashboard_summary(db: Session, current_time: Optional[datetime] = None) -> DashboardSummaryResponse:
    """
    Lightweight, N+1-free aggregator computing high-level fleet risk intelligence
    for the SentinelX command center dashboard.
    """
    now = current_time or datetime.now(timezone.utc)
    suppliers = db.query(Supplier).all()
    total_suppliers = len(suppliers)

    if total_suppliers == 0:
        return DashboardSummaryResponse(
            total_suppliers=0,
            average_risk=0.0,
            high_risk_supplier_count=0,
            medium_risk_supplier_count=0,
            low_risk_supplier_count=0,
            highest_risk_supplier=None,
            latest_risk_timestamp=None,
            recent_event_count=0,
            tier_distribution={"tier_1": 0, "tier_2": 0, "tier_3": 0},
        )

    # 1. Fetch latest risk score for each supplier in a single joined subquery
    subq = (
        db.query(
            RiskScore.supplier_id,
            func.max(RiskScore.timestamp).label("max_ts"),
        )
        .group_by(RiskScore.supplier_id)
        .subquery()
    )

    latest_scores = (
        db.query(RiskScore)
        .join(
            subq,
            (RiskScore.supplier_id == subq.c.supplier_id) & (RiskScore.timestamp == subq.c.max_ts),
        )
        .all()
    )
    score_by_supplier = {sc.supplier_id: sc for sc in latest_scores}

    # 2. Compute fleet-level metrics
    high_count = 0
    med_count = 0
    low_count = 0
    total_score = 0.0
    highest_score = -1.0
    highest_supplier_obj = None
    latest_ts = None

    for supp in suppliers:
        rec = score_by_supplier.get(supp.id)
        sc_val = rec.risk_score if rec is not None else 0.0
        total_score += sc_val

        if rec is not None and (latest_ts is None or rec.timestamp > latest_ts):
            latest_ts = rec.timestamp

        if sc_val >= 70.0:
            high_count += 1
        elif sc_val >= 40.0:
            med_count += 1
        else:
            low_count += 1

        if sc_val > highest_score:
            highest_score = sc_val
            highest_supplier_obj = supp

    avg_risk = round(total_score / total_suppliers, 1)

    highest_summary = None
    if highest_supplier_obj is not None and highest_score >= 0.0:
        highest_summary = HighestRiskSupplierSummary(
            id=highest_supplier_obj.id,
            name=highest_supplier_obj.name,
            risk_score=highest_score,
            criticality_tier=highest_supplier_obj.criticality_tier,
            region=highest_supplier_obj.region,
        )

    # 3. Active window (last 14 days) external risk events
    fourteen_days_ago = now - timedelta(days=14)
    recent_events = (
        db.query(func.count(RiskEvent.id))
        .filter(RiskEvent.detected_at >= fourteen_days_ago)
        .scalar()
        or 0
    )

    # 4. Criticality tier distribution
    tier_dist = {
        "tier_1": sum(1 for s in suppliers if s.criticality_tier == 1),
        "tier_2": sum(1 for s in suppliers if s.criticality_tier == 2),
        "tier_3": sum(1 for s in suppliers if s.criticality_tier == 3),
    }

    return DashboardSummaryResponse(
        total_suppliers=total_suppliers,
        average_risk=avg_risk,
        high_risk_supplier_count=high_count,
        medium_risk_supplier_count=med_count,
        low_risk_supplier_count=low_count,
        highest_risk_supplier=highest_summary,
        latest_risk_timestamp=latest_ts,
        recent_event_count=recent_events,
        tier_distribution=tier_dist,
    )
