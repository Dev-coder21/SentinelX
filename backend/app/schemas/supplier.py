from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SupplierBase(BaseModel):
    name: str = Field(..., max_length=255)
    region: str = Field(..., max_length=100)
    country: str = Field(..., max_length=100)
    category: str = Field(..., max_length=100)
    annual_spend: float = Field(default=0.0, ge=0.0)
    criticality_tier: int = Field(default=1, ge=1, le=5)


class SupplierCreate(SupplierBase):
    pass


class SupplierRead(SupplierBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
