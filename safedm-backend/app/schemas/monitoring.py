from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    package_name: str
    is_enabled: bool


class MonitoringPreferenceItem(BaseModel):
    """Préférence par application_id (catalogue) ou package_name (app libre)."""

    application_id: Optional[int] = None
    package_name: Optional[str] = Field(default=None, max_length=255)
    name: Optional[str] = Field(default=None, max_length=64)
    enabled: bool
    application: Optional[ApplicationResponse] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode="after")
    def require_id_or_package(self):
        if self.application_id is None and not (self.package_name or "").strip():
            raise ValueError("application_id ou package_name requis")
        return self


class MonitoringPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    enabled: bool
    updated_at: datetime
    application: ApplicationResponse


class MonitoringUpdateRequest(BaseModel):
    preferences: list[MonitoringPreferenceItem] = Field(min_length=1)
