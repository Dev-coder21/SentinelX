from datetime import datetime
from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
