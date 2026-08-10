from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import ThreatStatus
from app.schemas.report import ThreatResponse


class AdminStatsResponse(BaseModel):
    users_count: int
    reports_active_count: int
    reports_withdrawn_count: int
    threats_active_count: int
    threats_dismissed_count: int
    guide_articles_published: int
    supported_applications: int
    gemini_configured: bool
    virustotal_configured: bool
    analysis_demo_mode: bool


class ThreatStatusUpdateRequest(BaseModel):
    status: ThreatStatus


class AdminThreatListResponse(BaseModel):
    items: list[ThreatResponse]
    total: int
    page: int
    page_size: int
    status_filter: Optional[ThreatStatus] = None
