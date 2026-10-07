"""Contrat de sortie du moteur semantique (TypeSafe Jev).

Remplace l'ancien `GeminiResult`. Deux differences importantes :

1. `risk_score` est *derive* des probabilites calibrees de Jev, et non plus
   d'un entier invente dans du JSON libre.
2. `confidence` est nouveau. Gemini ne le fournissait pas. C'est la mesure
   d'incertitude reelle qui pilote le routage dans `fusion_service`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.models.enums import ThreatSeverity
from app.schemas.analysis_enums import ThreatType


@dataclass
class SemanticResult:
    available: bool
    risk_score: Optional[int] = None
    severity: Optional[ThreatSeverity] = None
    threat_type: Optional[ThreatType] = None
    reasons: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    # Incertitude du juge, entre 0 et 1. 1.0 = aucune ambiguite.
    confidence: Optional[float] = None
    error: Optional[str] = None
    raw: Optional[dict[str, Any]] = None