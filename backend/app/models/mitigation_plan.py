import uuid
from sqlalchemy import Column, Float, Text, DateTime, Uuid, JSON, func
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class MitigationPlan(Base):
    __tablename__ = "mitigation_plans"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    budget_constraint = Column(Float, nullable=False)
    selected_suppliers = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )
    expected_revenue_protected = Column(Float, nullable=False)
    total_budget_used = Column(Float, nullable=True, default=0.0)
    remaining_budget = Column(Float, nullable=True, default=0.0)
    objective_value = Column(Float, nullable=True, default=0.0)
    optimization_notes = Column(Text, nullable=True)
    optimization_metadata = Column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<MitigationPlan(budget={self.budget_constraint}, protected={self.expected_revenue_protected})>"
