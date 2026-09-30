import uuid
from sqlalchemy import Column, String, Float, Integer, Uuid
from sqlalchemy.orm import relationship

from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    region = Column(String(100), nullable=False, index=True)
    country = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    annual_spend = Column(Float, nullable=False, default=0.0)
    criticality_tier = Column(Integer, nullable=False, default=1)

    # Relationships
    dependencies = relationship(
        "Dependency",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )
    risk_scores = relationship(
        "RiskScore",
        back_populates="supplier",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Supplier(name='{self.name}', region='{self.region}', tier={self.criticality_tier})>"
