from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.dependency import DependencyRead
from app.schemas.risk_score import RiskScoreRead
from app.schemas.risk_event import RiskEventRead


class SupplierBase(BaseModel):
    name: str = Field(..., max_length=255)
    region: str = Field(..., max_length=100)
    country: str = Field(..., max_length=100)
    category: str = Field(..., max_length=100)
    annual_spend: float = Field(default=0.0, ge=0.0)
    criticality_tier: int = Field(default=1, ge=1, le=5)


class SupplierCreate(SupplierBase):
    id: Optional[UUID] = None


class SupplierRead(SupplierBase):
    id: UUID
    current_risk_score: Optional[float] = Field(default=None, description="Latest risk score 0-100 if available")
    dependency_count: Optional[int] = Field(default=0, description="Total product lines dependent on this supplier")
    product_lines: Optional[List[str]] = Field(default_factory=list, description="Unique product lines supplied")

    model_config = ConfigDict(from_attributes=True)


class SupplierDetail(SupplierBase):
    id: UUID
    current_risk_score: Optional[float] = Field(default=None, description="Latest risk score 0-100 if available")
    dependencies: List[DependencyRead] = Field(default_factory=list, description="Product dependency links")
    product_lines_affected: List[str] = Field(default_factory=list, description="List of company product lines affected")
    risk_history: List[RiskScoreRead] = Field(default_factory=list, description="Historical risk scores")
    related_risk_events: List[RiskEventRead] = Field(default_factory=list, description="Recent risk events for supplier region")

    model_config = ConfigDict(from_attributes=True)
