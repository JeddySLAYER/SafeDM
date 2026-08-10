"""SQLAlchemy models for SafeDM."""

from app.models.community_report import CommunityReport
from app.models.device import Device
from app.models.enums import (
    ReportSource,
    ReportStatus,
    ThreatSeverity,
    ThreatStatus,
    VirusTotalResult,
    VirusTotalScanStatus,
)
from app.models.guide_article import GuideArticle
from app.models.guide_category import GuideCategory
from app.models.monitoring_preference import MonitoringPreference
from app.models.supported_application import SupportedApplication
from app.models.threat import Threat
from app.models.threat_url import ThreatUrl
from app.models.user import User
from app.models.virustotal_scan import VirusTotalScan

__all__ = [
    "User",
    "Device",
    "SupportedApplication",
    "MonitoringPreference",
    "Threat",
    "CommunityReport",
    "ThreatUrl",
    "VirusTotalScan",
    "GuideCategory",
    "GuideArticle",
    "ThreatSeverity",
    "ThreatStatus",
    "ReportSource",
    "ReportStatus",
    "VirusTotalScanStatus",
    "VirusTotalResult",
]
