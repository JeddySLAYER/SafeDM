from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ThreatSeverity, VirusTotalResult
from app.schemas.analysis_enums import AnalysisSource, AnalysisStatus, ThreatType


class AnalysisRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20000)
    source: AnalysisSource = AnalysisSource.MANUAL
    application_package: Optional[str] = Field(default=None, max_length=255)
    sender: Optional[str] = Field(default=None, max_length=255)
    title: Optional[str] = Field(default=None, max_length=512)


class UrlGateRequest(BaseModel):
    """Analyse d'un lien avant ouverture (Link Gate)."""

    url: str = Field(min_length=4, max_length=2048)

    @field_validator("url")
    @classmethod
    def normalize_url(cls, value: str) -> str:
        url = (value or "").strip()
        if not url:
            raise ValueError("URL requise")
        if url.lower().startswith("www."):
            url = f"https://{url}"
        if not url.lower().startswith(("http://", "https://")):
            raise ValueError("URL http(s) requise")
        return url


class UrlAnalysisResult(BaseModel):
    url: str
    domain: Optional[str] = None
    available: bool
    result: VirusTotalResult = VirusTotalResult.UNKNOWN
    malicious_count: int = 0
    suspicious_count: int = 0
    harmless_count: int = 0
    error: Optional[str] = None


class CommunityMatch(BaseModel):
    matched: bool = False
    threat_id: Optional[int] = None
    report_count: int = 0
    community_score: float = 0.0
    severity: Optional[ThreatSeverity] = None
    raw_hash: Optional[str] = None
    normalized_hash: Optional[str] = None


class AnalysisResponse(BaseModel):
    status: AnalysisStatus
    risk_score: int = Field(ge=0, le=100)
    severity: ThreatSeverity
    threat_type: ThreatType
    reasons: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    urls: list[UrlAnalysisResult] = Field(default_factory=list)
    community: CommunityMatch
    providers: dict[str, Any] = Field(default_factory=dict)
    raw_hash: str
    normalized_hash: str
    analyzed_at: datetime
    content_stored: bool = False


class UrlGateResponse(AnalysisResponse):
    """Résultat Link Gate avec décision d'ouverture."""

    decision: Literal["ALLOW", "WARN", "BLOCK"]
    url: str
    domain: Optional[str] = None
    headline: str
    can_open: bool
