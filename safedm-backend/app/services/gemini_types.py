from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.models.enums import ThreatSeverity
from app.schemas.analysis_enums import ThreatType


@dataclass
class GeminiResult:
    available: bool
    risk_score: Optional[int] = None
    severity: Optional[ThreatSeverity] = None
    threat_type: Optional[ThreatType] = None
    reasons: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    error: Optional[str] = None
    raw: Optional[dict[str, Any]] = None
