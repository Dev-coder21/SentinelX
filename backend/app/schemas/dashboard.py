from typing import Optional, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class HighestRiskSupplierSummary(BaseModel):
    id: UUID = Field(..., description="Unique supplier UUID")
    name: str = Field(..., description="Supplier company name")
    risk_score: float = Field(..., description="Current evaluated risk score (0-100)")
    criticality_tier: int = Field(..., description="Tier 1, 2, or 3")
    region: str = Field(..., description="Primary geographic operating region")


class DashboardSummaryResponse(BaseModel):
    total_suppliers: int = Field(..., description="Total count of active suppliers in the network")
    average_risk: float = Field(..., description="Average current risk score across all suppliers (0-100)")
    high_risk_supplier_count: int = Field(..., description="Count of suppliers with risk score >= 70.0")
    medium_risk_supplier_count: int = Field(..., description="Count of suppliers with 40.0 <= risk score < 70.0")
    low_risk_supplier_count: int = Field(..., description="Count of suppliers with risk score < 40.0")
    highest_risk_supplier: Optional[HighestRiskSupplierSummary] = Field(
        None, description="Supplier with the highest current risk score"
    )
    latest_risk_timestamp: Optional[datetime] = Field(
        None, description="Timestamp of the most recent risk score calculation"
    )
    recent_event_count: int = Field(
        ..., description="Count of external risk events detected in the active window (last 14 days)"
    )
    tier_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Count of suppliers per criticality tier"
    )
