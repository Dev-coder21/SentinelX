from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CaseEventSchema(BaseModel):
    headline: str
    summary: Optional[str] = None
    region: str
    source: str
    event_type: str
    sentiment_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    severity: float = Field(default=50.0, ge=0.0, le=100.0)
    detected_at: datetime


class HistoricalCaseSchema(BaseModel):
    case_id: str
    name: str
    event_type: str
    affected_region: str
    affected_country: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    severity_rationale: str
    source_org: str
    source_urls: List[str]
    notes_on_facts: str
    events: List[CaseEventSchema]
    windows: Dict[str, datetime]


class EvaluationRecordSchema(BaseModel):
    case_id: str
    case_name: str
    window_name: str
    window_timestamp: datetime
    supplier_id: UUID
    supplier_name: str
    supplier_region: str
    is_affected_region: bool
    supplier_tier: int
    criticality_multiplier: float
    raw_aggregated_risk: float
    final_supplier_risk: float
    event_count: int
    notes: str


class CaseSummarySchema(BaseModel):
    case_id: str
    case_name: str
    affected_region: str
    supplier_tier: int
    supplier_name: str
    criticality_multiplier: float
    baseline_risk: float
    onset_risk: float
    peak_risk: float
    post_event_risk: float
    decay_check_risk: float
    risk_delta: float
    peak_recency_weight: float
    post_event_recency_weight: float
    multi_signal_count: int
