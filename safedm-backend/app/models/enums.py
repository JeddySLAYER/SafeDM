import enum


class ThreatSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ThreatStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    UNDER_REVIEW = "UNDER_REVIEW"
    DISMISSED = "DISMISSED"


class ReportSource(str, enum.Enum):
    NOTIFICATION = "NOTIFICATION"
    MANUAL_ANALYSIS = "MANUAL_ANALYSIS"
    DIRECT_REPORT = "DIRECT_REPORT"


class ReportStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    WITHDRAWN = "WITHDRAWN"


class VirusTotalScanStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"


class VirusTotalResult(str, enum.Enum):
    MALICIOUS = "MALICIOUS"
    SUSPICIOUS = "SUSPICIOUS"
    CLEAN = "CLEAN"
    UNKNOWN = "UNKNOWN"
