from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReportSource, ReportStatus, ThreatSeverity, ThreatStatus


class ReportCreateRequest(BaseModel):
    content: str = Field(min_length=8, max_length=20000)
    source: ReportSource = ReportSource.DIRECT_REPORT
    severity: ThreatSeverity = ThreatSeverity.MEDIUM
    application_package: Optional[str] = Field(default=None, max_length=255)


class FingerprintReportRequest(BaseModel):
    similarity_hash: str = Field(pattern=r"^[0-9a-fA-F]{16}$")
    source: ReportSource = ReportSource.DIRECT_REPORT
    severity: ThreatSeverity = ThreatSeverity.MEDIUM
    observed_at: Optional[datetime] = None
    application_package: Optional[str] = Field(default=None, max_length=255)


class FingerprintEnvelopeRequest(BaseModel):
    encrypted_key: str = Field(min_length=32, max_length=1024)
    nonce: str = Field(min_length=16, max_length=64)
    ciphertext: str = Field(min_length=16, max_length=8192)


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    threat_id: int
    user_id: int
    source: ReportSource
    status: ReportStatus
    created_at: datetime
    withdrawn_at: Optional[datetime] = None


class ReportCreateResponse(BaseModel):
    report: ReportResponse
    threat_id: int
    created_threat: bool
    content_stored: bool = True


class ThreatUrlResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_url: str
    domain: Optional[str] = None
    url_hash: str


class ThreatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_hash: str
    normalized_hash: str
    content: Optional[str] = None
    similarity_hash: Optional[str] = None
    report_count: int
    community_score: float
    severity: ThreatSeverity
    status: ThreatStatus
    first_seen_at: datetime
    last_seen_at: datetime
    urls: list[ThreatUrlResponse] = []


class ThreatListResponse(BaseModel):
    items: list[ThreatResponse]
    total: int
    page: int
    page_size: int


class UserReportItem(BaseModel):
    id: int
    threat_id: int
    source: ReportSource
    status: ReportStatus
    created_at: datetime
    withdrawn_at: Optional[datetime] = None
    severity: ThreatSeverity
    threat_preview: str
    report_count: int


class UserReportListResponse(BaseModel):
    items: list[UserReportItem]
    total: int
