from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PrioritizeRequest(BaseModel):
    budget: float = Field(
        ...,
        ge=0.0,
        le=1_000_000_000.0,
        description="Total capital budget allocated for risk mitigation actions in USD (must be between 0 and 1,000,000,000)",
        examples=[500000.0],
    )


class SelectedSupplierMitigation(BaseModel):
    supplier_id: UUID = Field(..., description="Unique supplier UUID")
    supplier_name: str = Field(..., description="Legal company name of supplier")
    current_risk_score: float = Field(..., description="Evaluated risk score (0-100)")
    criticality_tier: int = Field(..., description="Criticality tier (1, 2, or 3)")
    mitigation_cost: float = Field(..., description="Cost to execute mitigation action in USD")
    expected_protected_revenue: float = Field(
        ..., description="Estimated revenue protected from disruption in USD"
    )
    risk_exposure: float = Field(
        ..., description="Raw financial revenue exposed to risk prior to mitigation"
    )
    dependency_impact: float = Field(
        ..., description="Aggregate dependency weight across company product lines"
    )
    annual_spend: float = Field(..., description="Annual procurement spend in USD")
    mitigation_effectiveness: float = Field(
        ..., description="Risk reduction fraction achieved by mitigation (e.g. 0.75 = 75%)"
    )
    efficiency_ratio: float = Field(
        ..., description="Protected revenue per dollar of mitigation cost (ROI multiple)"
    )
    reason: str = Field(..., description="Human-readable deterministic explanation for selection")


class PrioritizeResponse(BaseModel):
    plan_id: Optional[UUID] = Field(None, description="UUID of persisted mitigation plan")
    generated_at: datetime = Field(..., description="UTC timestamp of optimization run")
    budget: float = Field(..., description="Requested mitigation budget in USD")
    selected_suppliers: List[SelectedSupplierMitigation] = Field(
        default_factory=list, description="Ranked list of suppliers prioritized for mitigation"
    )
    total_budget_used: float = Field(
        ..., description="Sum of mitigation costs for all selected suppliers"
    )
    remaining_budget: float = Field(
        ..., description="Unallocated remaining budget (budget - total_budget_used)"
    )
    total_expected_protected_revenue: float = Field(
        ..., description="Total financial revenue protected across all selected actions"
    )
    objective_value: float = Field(
        ..., description="Final objective function value from the PuLP solver"
    )
    selected_count: int = Field(
        ..., description="Number of suppliers selected for mitigation action"
    )
    optimization_status: str = Field(
        ..., description="Solver status: Optimal, Zero Budget, Infeasible, etc."
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Audit metadata (total evaluated, candidate count, solver details)"
    )

    model_config = ConfigDict(from_attributes=True)
