from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import (
    ReportSource,
    ReportStatus,
    ThreatSeverity,
    ThreatStatus,
    VirusTotalResult,
    VirusTotalScanStatus,
)
from app.schemas.monitoring import ApplicationResponse, MonitoringPreferenceResponse
from app.schemas.report import ThreatResponse, ThreatUrlResponse


class SeverityBucket(BaseModel):
    severity: ThreatSeverity
    count: int


class DayCount(BaseModel):
    day: str
    reports: int
    threats: int = 0


class TopThreatItem(BaseModel):
    id: int
    preview: str
    report_count: int
    severity: ThreatSeverity
    status: ThreatStatus


class ProviderHealth(BaseModel):
    gemini_configured: bool
    gemini_ok: bool
    virustotal_configured: bool
    virustotal_ok: bool
    analysis_demo_mode: bool
    detail: str = ""


class AdminStatsResponse(BaseModel):
    users_count: int
    reports_active_count: int
    reports_withdrawn_count: int
    threats_active_count: int
    threats_dismissed_count: int
    threats_under_review_count: int = 0
    guide_articles_published: int
    supported_applications: int
    gemini_configured: bool
    virustotal_configured: bool
    analysis_demo_mode: bool
    severity_distribution: list[SeverityBucket] = Field(default_factory=list)
    reports_last_7_days: list[DayCount] = Field(default_factory=list)
    top_reported_threats: list[TopThreatItem] = Field(default_factory=list)
    provider_health: Optional[ProviderHealth] = None
    link_gate_events_count: int = 0


class ThreatStatusUpdateRequest(BaseModel):
    status: ThreatStatus


class ThreatSeverityUpdateRequest(BaseModel):
    severity: ThreatSeverity


class AdminThreatListResponse(BaseModel):
    items: list[ThreatResponse]
    total: int
    page: int
    page_size: int
    status_filter: Optional[ThreatStatus] = None


class AdminUserItem(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: str
    devices_count: int = 0
    reports_count: int = 0


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    page_size: int


class AdminDeviceItem(BaseModel):
    id: int
    device_identifier: str
    created_at: str
    last_seen_at: Optional[str] = None


class AdminUserDetailResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: str
    devices: list[AdminDeviceItem] = Field(default_factory=list)
    monitoring: list[MonitoringPreferenceResponse] = Field(default_factory=list)
    reports_count: int = 0


class AdminUserUpdateRequest(BaseModel):
    is_admin: Optional[bool] = None


class AdminReportItem(BaseModel):
    id: int
    threat_id: int
    user_id: int
    username: str
    source: ReportSource
    status: ReportStatus
    created_at: str
    withdrawn_at: Optional[str] = None
    severity: ThreatSeverity
    threat_preview: str
    report_count: int


class AdminReportListResponse(BaseModel):
    items: list[AdminReportItem]
    total: int
    page: int
    page_size: int
    status_filter: Optional[ReportStatus] = None


class ApplicationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    package_name: str = Field(min_length=2, max_length=255)
    is_enabled: bool = True


class ApplicationUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    is_enabled: Optional[bool] = None


class VirusTotalScanItem(BaseModel):
    id: int
    status: VirusTotalScanStatus
    result: VirusTotalResult
    scanned_at: str


class AdminThreatUrlDetail(ThreatUrlResponse):
    scans: list[VirusTotalScanItem] = Field(default_factory=list)


class AdminThreatDetailResponse(ThreatResponse):
    urls: list[AdminThreatUrlDetail] = Field(default_factory=list)


class LinkGateEventItem(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    url: str
    domain: Optional[str] = None
    decision: str
    risk_score: int
    severity: str
    status: str
    created_at: str


class LinkGateEventListResponse(BaseModel):
    items: list[LinkGateEventItem]
    total: int
    page: int
    page_size: int
