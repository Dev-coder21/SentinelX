from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RiskScoreBase(BaseModel):
    supplier_id: UUID
    risk_score: float = Field(..., ge=0.0, le=100.0)
    contributing_factors: Optional[Dict[str, Any]] = None


class RiskScoreCreate(RiskScoreBase):
    timestamp: Optional[datetime] = None


class RiskScoreRead(RiskScoreBase):
    id: UUID
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
