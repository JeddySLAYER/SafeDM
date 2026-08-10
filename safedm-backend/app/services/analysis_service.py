"""Orchestrateur du pipeline d'analyse SafeDM.

Important: le contenu analysé n'est JAMAIS persisté ici.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import ThreatSeverity
from app.repositories.threat_repository import ThreatRepository
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, CommunityMatch
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.fusion_service import fuse_analysis
from app.services.gemini_service import GeminiService
from app.services.gemini_types import GeminiResult
from app.services.virustotal_service import VirusTotalService
from app.utils.hashing import compute_normalized_hash, compute_raw_hash
from app.utils.url_extraction import extract_urls

logger = logging.getLogger(__name__)

MIN_CONTENT_LENGTH = 8


class AnalysisService:
    def __init__(
        self,
        db: Session,
        gemini: Optional[GeminiService] = None,
        virustotal: Optional[VirusTotalService] = None,
    ):
        self.db = db
        self.gemini = gemini or GeminiService()
        self.virustotal = virustotal or VirusTotalService()
        self.threats = ThreatRepository(db)

    def analyze(self, payload: AnalysisRequest) -> AnalysisResponse:
        content = (payload.content or "").strip()
        raw_hash = compute_raw_hash(content)
        normalized_hash = compute_normalized_hash(content)

        # Ne jamais logger le contenu
        logger.info(
            "analysis_start source=%s package=%s content_len=%s",
            payload.source.value,
            payload.application_package,
            len(content),
        )

        if len(content) < MIN_CONTENT_LENGTH:
            return AnalysisResponse(
                status=AnalysisStatus.INSUFFICIENT_CONTENT,
                risk_score=0,
                severity=ThreatSeverity.LOW,
                threat_type=ThreatType.NONE,
                reasons=["Contenu insuffisant pour une analyse fiable"],
                recommendations=[
                    "Coller le message complet avant d'analyser",
                    "Ne pas conclure à la sécurité d'un message tronqué",
                ],
                urls=[],
                community=CommunityMatch(
                    matched=False,
                    raw_hash=raw_hash,
                    normalized_hash=normalized_hash,
                ),
                providers={"gemini": {"skipped": True}, "virustotal": {"skipped": True}},
                raw_hash=raw_hash,
                normalized_hash=normalized_hash,
                analyzed_at=datetime.now(timezone.utc),
                content_stored=False,
            )

        community = self.threats.find_by_hashes(raw_hash, normalized_hash)
        gemini_result: GeminiResult = self.gemini.analyze(content)
        urls = extract_urls(content)
        url_results = self.virustotal.scan_urls(urls) if urls else []

        fused = fuse_analysis(
            gemini=gemini_result,
            url_results=url_results,
            community=community,
            urls_detected=bool(urls),
        )

        logger.info(
            "analysis_done status=%s score=%s urls=%s community=%s content_stored=false",
            fused["status"].value,
            fused["risk_score"],
            len(url_results),
            community.matched,
        )

        return AnalysisResponse(
            status=fused["status"],
            risk_score=fused["risk_score"],
            severity=fused["severity"],
            threat_type=fused["threat_type"],
            reasons=fused["reasons"],
            recommendations=fused["recommendations"],
            urls=url_results,
            community=community,
            providers=fused["providers"],
            raw_hash=raw_hash,
            normalized_hash=normalized_hash,
            analyzed_at=datetime.now(timezone.utc),
            content_stored=False,
        )
