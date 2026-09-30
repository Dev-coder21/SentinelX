from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RiskEventBase(BaseModel):
    region: str = Field(..., max_length=100)
    source: str = Field(..., max_length=50)  # news, weather, shipping
    headline: str = Field(..., max_length=500)
    summary: Optional[str] = None
    sentiment_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    event_type: str = Field(..., max_length=100)
    raw_url: Optional[str] = Field(default=None, max_length=1000)
    fingerprint: Optional[str] = Field(default=None, max_length=64)
    severity: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    classification_source: Optional[str] = Field(default=None, max_length=50)


class RiskEventCreate(RiskEventBase):
    id: Optional[UUID] = None
    detected_at: Optional[datetime] = None


class RiskEventRead(RiskEventBase):
    id: UUID
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True)
