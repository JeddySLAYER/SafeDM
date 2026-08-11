"""Orchestrateur du pipeline d'analyse SafeDM.

Important: le contenu analysé n'est JAMAIS persisté ici.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import ThreatSeverity, VirusTotalResult
from app.repositories.threat_repository import ThreatRepository
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    CommunityMatch,
    UrlGateRequest,
    UrlGateResponse,
)
from app.schemas.analysis_enums import AnalysisSource, AnalysisStatus, ThreatType
from app.services.fusion_service import fuse_analysis
from app.services.gemini_service import GeminiService
from app.services.gemini_types import GeminiResult
from app.services.virustotal_service import VirusTotalService
from app.utils.hashing import compute_normalized_hash, compute_raw_hash
from app.utils.url_extraction import extract_domain, extract_urls

logger = logging.getLogger(__name__)

MIN_CONTENT_LENGTH = 8


def _link_gate_decision(
    *,
    status: AnalysisStatus,
    severity: ThreatSeverity,
    risk_score: int,
    url_results: list,
) -> tuple[str, str, bool]:
    """
    Décision d'ouverture d'un lien.
    UNKNOWN/PARTIAL ne sont JAMAIS traités comme sûrs.
    """
    vt_malicious = any(
        getattr(u, "result", None) == VirusTotalResult.MALICIOUS for u in url_results
    )
    vt_suspicious = any(
        getattr(u, "result", None) == VirusTotalResult.SUSPICIOUS for u in url_results
    )
    vt_unavailable = any(not getattr(u, "available", False) for u in url_results)

    if (
        status == AnalysisStatus.DANGEROUS
        or severity in (ThreatSeverity.HIGH, ThreatSeverity.CRITICAL)
        or risk_score >= 65
        or vt_malicious
    ):
        return (
            "BLOCK",
            "Lien dangereux — ouverture bloquée",
            False,
        )

    if (
        status
        in (
            AnalysisStatus.UNKNOWN,
            AnalysisStatus.PARTIAL,
            AnalysisStatus.INSUFFICIENT_CONTENT,
        )
        or vt_unavailable
        or status == AnalysisStatus.SUSPICIOUS
        or severity == ThreatSeverity.MEDIUM
        or risk_score >= 35
        or vt_suspicious
    ):
        return (
            "WARN",
            "Lien suspect ou non vérifié — prudence",
            True,
        )

    return (
        "ALLOW",
        "Aucun signal critique — ouverture autorisée",
        True,
    )


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

    def analyze_url(self, payload: UrlGateRequest) -> UrlGateResponse:
        """Pipeline Link Gate : VirusTotal obligatoire + communauté + Gemini léger."""
        url = payload.url.strip()
        domain = extract_domain(url)
        raw_hash = compute_raw_hash(url)
        normalized_hash = compute_normalized_hash(url)

        logger.info("link_gate_start domain=%s", domain)

        community = self.threats.find_by_url(url)
        # Gemini analyse le contexte « lien » (pas le contenu d'une page)
        prompt_content = (
            f"Analyse ce lien reçu par un utilisateur. "
            f"URL: {url}. Domaine: {domain or 'inconnu'}. "
            "Indique si le domaine ou le motif ressemble à du phishing."
        )
        gemini_result: GeminiResult = self.gemini.analyze(prompt_content)
        url_results = self.virustotal.scan_urls([url])

        fused = fuse_analysis(
            gemini=gemini_result,
            url_results=url_results,
            community=community,
            urls_detected=True,
        )

        # Renforce si communauté a signalé l'URL
        if community.matched and community.severity in (
            ThreatSeverity.HIGH,
            ThreatSeverity.CRITICAL,
        ):
            fused["status"] = AnalysisStatus.DANGEROUS
            fused["risk_score"] = max(fused["risk_score"], 80)
            fused["severity"] = ThreatSeverity.HIGH
            fused["reasons"] = [
                "Lien déjà signalé par la communauté",
                *fused["reasons"],
            ]

        decision, headline, can_open = _link_gate_decision(
            status=fused["status"],
            severity=fused["severity"],
            risk_score=fused["risk_score"],
            url_results=url_results,
        )

        logger.info(
            "link_gate_done decision=%s status=%s score=%s content_stored=false",
            decision,
            fused["status"].value,
            fused["risk_score"],
        )

        return UrlGateResponse(
            status=fused["status"],
            risk_score=fused["risk_score"],
            severity=fused["severity"],
            threat_type=fused["threat_type"]
            if fused["threat_type"] != ThreatType.NONE
            else ThreatType.MALICIOUS_LINK,
            reasons=fused["reasons"],
            recommendations=fused["recommendations"]
            or [
                "Ne pas saisir d'identifiants sur ce site",
                "Vérifier l'expéditeur du lien",
            ],
            urls=url_results,
            community=community,
            providers=fused["providers"],
            raw_hash=raw_hash,
            normalized_hash=normalized_hash,
            analyzed_at=datetime.now(timezone.utc),
            content_stored=False,
            decision=decision,
            url=url,
            domain=domain,
            headline=headline,
            can_open=can_open,
        )
