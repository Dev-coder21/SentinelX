from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload, joinedload

from app.core.database import get_db
from app.models.supplier import Supplier
from app.models.risk_event import RiskEvent
from app.schemas.supplier import SupplierRead, SupplierDetail

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def determine_risk_level(score: Optional[float]) -> Optional[str]:
    """Categorizes numerical 0-100 risk score into human-readable tier."""
    if score is None:
        return None
    if score < 35.0:
        return "LOW"
    elif score < 65.0:
        return "MEDIUM"
    elif score < 80.0:
        return "HIGH"
    return "CRITICAL"


@router.get("", response_model=List[SupplierRead])
def list_suppliers(
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of suppliers to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
) -> List[SupplierRead]:
    """
    List supplier records with pagination support.
    Includes current risk score, risk level classification, and product dependencies.
    """
    suppliers = (
        db.query(Supplier)
        .options(
            selectinload(Supplier.dependencies),
            selectinload(Supplier.risk_scores),
        )
        .order_by(Supplier.criticality_tier.asc(), Supplier.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for s in suppliers:
        latest_score = None
        if s.risk_scores:
            latest = max(s.risk_scores, key=lambda rs: rs.timestamp)
            latest_score = latest.risk_score

        product_lines = sorted(list(set(d.company_product for d in s.dependencies)))

        results.append(
            SupplierRead(
                id=s.id,
                name=s.name,
                region=s.region,
                country=s.country,
                category=s.category,
                annual_spend=s.annual_spend,
                criticality_tier=s.criticality_tier,
                current_risk_score=latest_score,
                risk_level=determine_risk_level(latest_score),
                dependency_count=len(s.dependencies),
                product_lines=product_lines,
            )
        )

    return results


@router.get("/{id}", response_model=SupplierDetail)
def get_supplier_detail(
    id: UUID,
    db: Session = Depends(get_db),
) -> SupplierDetail:
    """
    Get detailed information for a single supplier including its dependencies,
    affected product lines, timestamped risk history, explainable contributing factors,
    and relevant regional risk events.
    """
    supplier = (
        db.query(Supplier)
        .options(
            joinedload(Supplier.dependencies),
            selectinload(Supplier.risk_scores),
        )
        .filter(Supplier.id == id)
        .first()
    )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID '{id}' was not found.",
        )

    latest_score = None
    prev_score = None
    risk_trend = None
    contributing_factors = None
    sorted_risk_scores = []

    if supplier.risk_scores:
        sorted_risk_scores = sorted(supplier.risk_scores, key=lambda rs: rs.timestamp, reverse=True)
        latest_score = sorted_risk_scores[0].risk_score
        contributing_factors = sorted_risk_scores[0].contributing_factors

        if len(sorted_risk_scores) > 1:
            prev_score = sorted_risk_scores[1].risk_score
            if latest_score > prev_score:
                risk_trend = "increasing"
            elif latest_score < prev_score:
                risk_trend = "decreasing"
            else:
                risk_trend = "stable"

    product_lines_affected = sorted(list(set(d.company_product for d in supplier.dependencies)))

    # Fetch recent risk events matching this supplier's region
    related_events = (
        db.query(RiskEvent)
        .filter(RiskEvent.region == supplier.region)
        .order_by(RiskEvent.detected_at.desc())
        .limit(10)
        .all()
    )

    return SupplierDetail(
        id=supplier.id,
        name=supplier.name,
        region=supplier.region,
        country=supplier.country,
        category=supplier.category,
        annual_spend=supplier.annual_spend,
        criticality_tier=supplier.criticality_tier,
        current_risk_score=latest_score,
        previous_risk_score=prev_score,
        risk_trend=risk_trend,
        risk_level=determine_risk_level(latest_score),
        contributing_factors=contributing_factors,
        dependencies=supplier.dependencies,
        product_lines_affected=product_lines_affected,
        risk_history=sorted_risk_scores,
        related_risk_events=related_events,
    )
