from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DeviceCreateRequest(BaseModel):
    device_identifier: str = Field(min_length=3, max_length=255)


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    device_identifier: str
    created_at: datetime
    last_seen_at: Optional[datetime] = None
