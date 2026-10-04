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
from app.services.jev_service import JevService
from app.services.semantic_types import SemanticResult
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
        jev: Optional[JevService] = None,
        virustotal: Optional[VirusTotalService] = None,
    ):
        self.db = db
        self.jev = jev or JevService()
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
                providers={"jev": {"skipped": True}, "virustotal": {"skipped": True}},
                raw_hash=raw_hash,
                normalized_hash=normalized_hash,
                analyzed_at=datetime.now(timezone.utc),
                content_stored=False,
            )

        community = self.threats.find_by_hashes(raw_hash, normalized_hash)
        urls = extract_urls(content)

        # Aucun appel externe sans consentement explicite. La recherche
        # communautaire ci-dessus reste autorisee parce qu'elle ne sort que des
        # empreintes : aucun contenu n'est transmis.
        if not payload.consent_external:
            return self._local_only_response(
                raw_hash=raw_hash,
                normalized_hash=normalized_hash,
                community=community,
                urls=urls,
                reason="consentement externe non fourni",
            )

        # Jev est interroge une seule fois, apres extraction des URLs :
        # `urls` sert a la question link_deception et evite un second aller-retour.
        semantic_result: SemanticResult = self.jev.analyze(content, urls)

        url_results = self.virustotal.scan_urls(urls) if urls else []

        fused = fuse_analysis(
            semantic=semantic_result,
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

    def _local_only_response(
        self,
        *,
        raw_hash: str,
        normalized_hash: str,
        community: CommunityMatch,
        urls: list[str],
        reason: str,
    ) -> AnalysisResponse:
        """Reponse quand aucun analyseur externe n'est autorise.

        Le statut est `UNKNOWN`, **jamais** `SAFE`. Conclure « sur » sans avoir
        rien analyse serait une affirmation de securite non etayee : c'est
        exactement le piege que le garde-fou de confiance de `fuse_analysis`
        cherche a eviter cote Jev, il doit s'appliquer aussi ici.

        La comunaute peut casser l'ignorerance : si elle a deja signale ce
        message, on le sait sans rien transmettre.
        """
        if community.matched and community.severity in (
            ThreatSeverity.HIGH,
            ThreatSeverity.CRITICAL,
        ):
            status = AnalysisStatus.DANGEROUS
            severity = community.severity
            reasons = [
                f"{reason} : analyse semantique non executee",
                "Ce message correspond a un signalement deja connu "
                f"({community.report_count} signalement(s))",
            ]
            score = 85
        elif community.matched:
            status = AnalysisStatus.SUSPICIOUS
            severity = community.severity or ThreatSeverity.MEDIUM
            reasons = [
                f"{reason} : analyse semantique non executee",
                f"Message deja signale {community.report_count} fois par la communaute",
            ]
            score = 60
        else:
            status = AnalysisStatus.UNKNOWN
            severity = ThreatSeverity.LOW
            reasons = [
                f"{reason} : le message n'a pas ete analyse",
                "La decision locale sur l'appareil est la seule disponible",
            ]
            score = 0

        if urls and status is AnalysisStatus.UNKNOWN:
            reasons.append(
                f"{len(urls)} lien(s) detecte(s) non verifie(s) : "
                "l'analyse necessite le consentement externe"
            )

        return AnalysisResponse(
            status=status,
            risk_score=score,
            severity=severity,
            threat_type=ThreatType.NONE,
            reasons=reasons,
            recommendations=[
                "Activer l'analyse cloud pour une judgement semantique",
                "Ne pas Considerer ce message comme sur : il n'a pas ete analyse",
            ],
            urls=[],
            community=community,
            providers={
                "jev": {"skipped": True, "reason": reason},
                "virustotal": {"skipped": True, "reason": reason},
            },
            raw_hash=raw_hash,
            normalized_hash=normalized_hash,
            analyzed_at=datetime.now(timezone.utc),
            content_stored=False,
        )

    def analyze_url(
        self, payload: UrlGateRequest, *, user_id: int | None = None
    ) -> UrlGateResponse:
        """Pipeline Link Gate : VirusTotal obligatoire + communauté + Jev léger."""
        url = payload.url.strip()
        domain = extract_domain(url)
        raw_hash = compute_raw_hash(url)
        normalized_hash = compute_normalized_hash(url)

        logger.info("link_gate_start domain=%s", domain)

        community = self.threats.find_by_url(url)

        if not payload.consent_external:
            logger.info("link_gate_skipped_no_consent domain=%s", domain)
            # La communaute est deja interrogee (empreintes seules) : un lien
            # deja signale reste dangereux sans qu'on ait besoin de Jev ni VT.
            if community.matched:
                status = AnalysisStatus.DANGEROUS
                score = 85
                reasons = [
                    "Consentement externe non fourni : lien non analyse",
                    f"Lien deja signale {community.report_count} fois par la communaute",
                ]
            else:
                status = AnalysisStatus.UNKNOWN
                score = 0
                reasons = [
                    "Consentement externe non fourni : lien non analyse",
                    "Ne pasconsiderer ce lien comme sur : il n'a pas ete verifie",
                ]

            decision, headline, can_open = _link_gate_decision(
                status=status,
                severity=ThreatSeverity.HIGH if status is AnalysisStatus.DANGEROUS
                else ThreatSeverity.LOW,
                risk_score=score,
                url_results=[],
            )

            return UrlGateResponse(
                status=status,
                risk_score=score,
                severity=ThreatSeverity.HIGH
                if status is AnalysisStatus.DANGEROUS
                else ThreatSeverity.LOW,
                threat_type=ThreatType.MALICIOUS_LINK,
                reasons=reasons,
                recommendations=[
                    "Relancer l'analyse pour autoriser l'envoi du lien a VirusTotal",
                ],
                urls=[],
                community=community,
                providers={
                    "jev": {"skipped": True, "reason": "consentement non fourni"},
                    "virustotal": {
                        "skipped": True,
                        "reason": "consentement non fourni",
                    },
                },
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

        # Jev analyse le contexte « lien » (pas le contenu d'une page).
        # On lui passe l'URL dans `state` plutot que dans le texte : c'est le
        # champ prevu pour ca, et la question link_deception s'en sert.
        semantic_result: SemanticResult = self.jev.analyze(
            f"Lien recu par un utilisateur. Domaine: {domain or 'inconnu'}.",
            [url],
        )
        url_results = self.virustotal.scan_urls([url])

        fused = fuse_analysis(
            semantic=semantic_result,
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

        self._persist_link_gate_event(
            user_id=user_id,
            url=url,
            domain=domain,
            decision=decision,
            risk_score=fused["risk_score"],
            severity=fused["severity"].value,
            status=fused["status"].value,
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

    def _persist_link_gate_event(
        self,
        *,
        user_id: int | None,
        url: str,
        domain: str | None,
        decision: str,
        risk_score: int,
        severity: str,
        status: str,
    ) -> None:
        """Journal ops — URL + décision (pas le contenu de page)."""
        try:
            from app.models import LinkGateEvent

            event = LinkGateEvent(
                user_id=user_id,
                url=url[:4000],
                domain=(domain or "")[:255] or None,
                decision=decision,
                risk_score=risk_score,
                severity=severity,
                status=status,
            )
            self.db.add(event)
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("link_gate_persist_failed")
