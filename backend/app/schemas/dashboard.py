from typing import Optional, Dict, List, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class HighestRiskSupplierSummary(BaseModel):
    id: UUID = Field(..., description="Unique supplier UUID")
    name: str = Field(..., description="Supplier company name")
    risk_score: float = Field(..., description="Current evaluated risk score (0-100)")
    criticality_tier: int = Field(..., description="Tier 1, 2, or 3")
    region: str = Field(..., description="Primary geographic operating region")


class DashboardOverview(BaseModel):
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


class RiskDistributionItem(BaseModel):
    level: str = Field(..., description="Risk category: LOW, MEDIUM, HIGH, or CRITICAL")
    count: int = Field(..., description="Number of suppliers in this category")
    percentage: float = Field(..., description="Percentage of total fleet in this category")


class RegionalRiskSummary(BaseModel):
    region: str = Field(..., description="Operating region name")
    supplier_count: int = Field(..., description="Total suppliers located in this region")
    average_risk: float = Field(..., description="Average risk score of suppliers in this region")
    highest_risk: float = Field(..., description="Maximum risk score among suppliers in this region")
    high_risk_supplier_count: int = Field(..., description="Count of suppliers with risk >= 70.0 in this region")


class RiskTrendPoint(BaseModel):
    timestamp: datetime = Field(..., description="Historical snapshot observation timestamp")
    average_risk: float = Field(..., description="Average fleet risk score at this timestamp")
    high_risk_count: int = Field(..., description="Count of suppliers with risk >= 70.0 at this timestamp")
    scored_supplier_count: int = Field(..., description="Number of suppliers scored in this snapshot")


class EventTypeDistributionItem(BaseModel):
    event_type: str = Field(..., description="Classified risk event category")
    count: int = Field(..., description="Number of events of this type")
    percentage: float = Field(..., description="Percentage of recent events of this type")


class DashboardRecentEvent(BaseModel):
    id: UUID = Field(..., description="Unique risk event ID")
    detected_at: datetime = Field(..., description="Event detection timestamp")
    region: str = Field(..., description="Geographic region")
    source: str = Field(..., description="Source provider: news, weather, etc.")
    event_type: str = Field(..., description="Classified event type")
    headline: str = Field(..., description="Event headline / title")
    summary: Optional[str] = Field(None, description="Detailed text summary")
    severity: Optional[float] = Field(None, description="Evaluated severity (0-100)")
    confidence: Optional[float] = Field(None, description="Classification confidence (0-1)")
    sentiment_score: float = Field(0.0, description="Sentiment polarity (-1.0 to 1.0)")
    affected_suppliers: List[str] = Field(default_factory=list, description="Names of suppliers operating in this region")


class DashboardOptimizationSummary(BaseModel):
    plan_id: UUID = Field(..., description="Persisted mitigation plan UUID")
    generated_at: datetime = Field(..., description="Optimization run timestamp")
    budget: float = Field(..., description="Mitigation budget constraint in USD")
    total_budget_used: float = Field(..., description="Capital allocated across selected suppliers")
    remaining_budget: float = Field(..., description="Unallocated remaining capital")
    selected_count: int = Field(..., description="Number of suppliers prioritized")
    expected_protected_revenue: float = Field(..., description="Total revenue protected from disruption")
    objective_value: float = Field(..., description="Optimization objective value")
    optimization_status: Optional[str] = Field(None, description="Solver status")


class DashboardSummaryResponse(BaseModel):
    # Top-level backwards-compatible fields (preserved from Phase 5)
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

    # Phase 7 Production Command-Center Sections
    overview: DashboardOverview = Field(..., description="High-level fleet summary KPIs")
    risk_distribution: List[RiskDistributionItem] = Field(
        default_factory=list, description="Distribution across LOW, MEDIUM, HIGH, CRITICAL tiers"
    )
    regional_risk: List[RegionalRiskSummary] = Field(
        default_factory=list, description="Aggregated risk metrics per operating region"
    )
    risk_trend: List[RiskTrendPoint] = Field(
        default_factory=list, description="Bounded historical risk trend for Recharts time-series"
    )
    event_distribution: List[EventTypeDistributionItem] = Field(
        default_factory=list, description="Recent event counts grouped by classification type"
    )
    recent_events: List[DashboardRecentEvent] = Field(
        default_factory=list, description="Bounded list of recent significant risk events with affected suppliers"
    )
    latest_optimization: Optional[DashboardOptimizationSummary] = Field(
        None, description="Summary of latest mitigation prioritization plan if present"
    )
    generated_at: datetime = Field(..., description="UTC timestamp when this dashboard snapshot was computed")
