from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    package_name: str
    is_enabled: bool


class MonitoringPreferenceItem(BaseModel):
    application_id: int
    enabled: bool
    application: Optional[ApplicationResponse] = None
    updated_at: Optional[datetime] = None


class MonitoringPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    enabled: bool
    updated_at: datetime
    application: ApplicationResponse


class MonitoringUpdateRequest(BaseModel):
    preferences: list[MonitoringPreferenceItem] = Field(min_length=1)
