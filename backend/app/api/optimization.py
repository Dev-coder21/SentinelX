import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.mitigation_plan import MitigationPlan
from app.schemas.optimization import (
    PrioritizeRequest,
    PrioritizeResponse,
    SelectedSupplierMitigation,
)
from app.services.optimization import MitigationOptimizerService

logger = logging.getLogger("sentinelx.api.optimization")

router = APIRouter(tags=["Optimization"])


@router.post(
    "/prioritize",
    response_model=PrioritizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute constrained risk mitigation prioritization",
)
def prioritize_mitigations(
    request: PrioritizeRequest,
    db: Session = Depends(get_db),
) -> PrioritizeResponse:
    """
    Given a capital mitigation budget (B), solves a 0-1 Knapsack linear program
    to select the optimal subset of at-risk suppliers that maximizes expected
    protected revenue without exceeding the budget limit.
    """
    try:
        service = MitigationOptimizerService(db=db)
        return service.optimize(budget=request.budget, persist=True)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error(f"Optimization service error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization engine error: {exc}",
        )


@router.get(
    "/mitigation-plans/latest",
    response_model=PrioritizeResponse,
    summary="Retrieve most recent persisted mitigation plan",
)
def get_latest_mitigation_plan(
    db: Session = Depends(get_db),
) -> PrioritizeResponse:
    """
    Retrieves the most recent persisted mitigation plan, including selected actions,
    allocated budget, protected revenue, and decision rationale.
    """
    plan = (
        db.query(MitigationPlan)
        .order_by(MitigationPlan.generated_at.desc())
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No mitigation plan has been generated yet.",
        )

    # Reconstruct SelectedSupplierMitigation models from JSON data
    raw_selections = plan.selected_suppliers or []
    selected_models: List[SelectedSupplierMitigation] = []
    for item in raw_selections:
        try:
            selected_models.append(SelectedSupplierMitigation(**item))
        except Exception as parse_err:
            logger.warning(f"Could not parse supplier selection: {parse_err}")

    return PrioritizeResponse(
        plan_id=plan.id,
        generated_at=plan.generated_at,
        budget=plan.budget_constraint,
        selected_suppliers=selected_models,
        total_budget_used=plan.total_budget_used or 0.0,
        remaining_budget=plan.remaining_budget or 0.0,
        total_expected_protected_revenue=plan.expected_revenue_protected,
        objective_value=plan.objective_value or plan.expected_revenue_protected,
        selected_count=len(selected_models),
        optimization_status=plan.optimization_notes or "Optimal",
        metadata=plan.optimization_metadata or {},
    )
