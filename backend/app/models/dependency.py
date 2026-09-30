import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Uuid
from sqlalchemy.orm import relationship

from app.core.database import Base


class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_product = Column(String(255), nullable=False, index=True)
    supplier_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependency_weight = Column(Float, nullable=False, default=1.0)

    # Relationships
    supplier = relationship("Supplier", back_populates="dependencies")

    def __repr__(self) -> str:
        return f"<Dependency(product='{self.company_product}', supplier_id='{self.supplier_id}', weight={self.dependency_weight})>"
