import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, Uuid, JSON, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    risk_score = Column(Float, nullable=False)  # 0.0 to 100.0
    contributing_factors = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    # Relationships
    supplier = relationship("Supplier", back_populates="risk_scores")

    def __repr__(self) -> str:
        return f"<RiskScore(supplier_id='{self.supplier_id}', score={self.risk_score})>"
