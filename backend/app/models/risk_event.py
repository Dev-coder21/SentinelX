import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, Uuid, func

from app.core.database import Base


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    region = Column(String(100), nullable=False, index=True)
    source = Column(String(50), nullable=False, index=True)  # news, weather, shipping
    headline = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    sentiment_score = Column(Float, nullable=False, default=0.0)  # -1.0 to +1.0
    event_type = Column(String(100), nullable=False, default="other", index=True)
    detected_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    raw_url = Column(String(1000), nullable=True)
    fingerprint = Column(String(64), nullable=True, unique=True, index=True)

    # Phase 4 NLP & Event Intelligence attributes
    severity = Column(Float, nullable=True)  # 0.0 to 100.0
    confidence = Column(Float, nullable=True)  # 0.0 to 1.0
    classification_source = Column(String(50), nullable=True)  # 'gemini', 'fallback', 'weather_detector'

    def __repr__(self) -> str:
        return f"<RiskEvent(region='{self.region}', source='{self.source}', event_type='{self.event_type}', severity={self.severity})>"
