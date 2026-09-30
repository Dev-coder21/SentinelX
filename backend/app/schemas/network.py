from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NetworkNode(BaseModel):
    id: str = Field(..., description="Unique node identifier (supplier UUID or product identifier)")
    name: str = Field(..., description="Display name of node")
    type: str = Field(default="supplier", description="Node type: 'supplier' or 'product'")
    region: str = Field(..., description="Geographic region")
    country: str = Field(..., description="Country")
    category: str = Field(..., description="Component or product category")
    criticality_tier: int = Field(default=1, description="Criticality tier (1=critical, 2=high, 3=moderate)")
    annual_spend: Optional[float] = Field(default=None, description="Annual spend in USD")
    current_risk_score: Optional[float] = Field(default=None, description="Current risk score (0-100)")

    model_config = ConfigDict(from_attributes=True)


class NetworkEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID (supplier UUID)")
    target: str = Field(..., description="Target node ID (product line node ID)")
    dependency_weight: float = Field(..., ge=0.0, le=1.0, description="Dependency criticality weight (0.0 to 1.0)")
    company_product: str = Field(..., description="Company product line name")

    model_config = ConfigDict(from_attributes=True)


class NetworkGraphResponse(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]

    model_config = ConfigDict(from_attributes=True)
