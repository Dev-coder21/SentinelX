from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DependencyBase(BaseModel):
    company_product: str = Field(..., max_length=255)
    supplier_id: UUID
    dependency_weight: float = Field(default=1.0, ge=0.0, le=1.0)


class DependencyCreate(DependencyBase):
    pass


class DependencyRead(DependencyBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
