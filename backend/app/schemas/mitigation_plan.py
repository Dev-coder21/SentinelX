from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MitigationPlanRequest(BaseModel):
    budget_constraint: float = Field(..., gt=0.0, description="Mitigation budget limit")


class MitigationPlanBase(BaseModel):
    budget_constraint: float = Field(..., gt=0.0)
    selected_suppliers: List[Dict[str, Any]]
    expected_revenue_protected: float = Field(..., ge=0.0)
    optimization_notes: Optional[str] = None


class MitigationPlanCreate(MitigationPlanBase):
    generated_at: Optional[datetime] = None


class MitigationPlanRead(MitigationPlanBase):
    id: UUID
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
