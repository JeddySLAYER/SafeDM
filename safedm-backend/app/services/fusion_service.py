"""Fusion Gemini + VirusTotal + communauté → score final."""

from __future__ import annotations

from app.models.enums import ThreatSeverity, VirusTotalResult
from app.schemas.analysis import CommunityMatch, UrlAnalysisResult
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.gemini_types import GeminiResult

_SEVERITY_RANK = {
    ThreatSeverity.LOW: 1,
    ThreatSeverity.MEDIUM: 2,
    ThreatSeverity.HIGH: 3,
    ThreatSeverity.CRITICAL: 4,
}


def _severity_from_score(score: int) -> ThreatSeverity:
    if score >= 85:
        return ThreatSeverity.CRITICAL
    if score >= 65:
        return ThreatSeverity.HIGH
    if score >= 35:
        return ThreatSeverity.MEDIUM
    return ThreatSeverity.LOW


def _max_severity(a: ThreatSeverity, b: ThreatSeverity) -> ThreatSeverity:
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


def _status_from_score(score: int) -> AnalysisStatus:
    if score >= 65:
        return AnalysisStatus.DANGEROUS
    if score >= 35:
        return AnalysisStatus.SUSPICIOUS
    return AnalysisStatus.SAFE


def fuse_analysis(
    *,
    gemini: GeminiResult,
    url_results: list[UrlAnalysisResult],
    community: CommunityMatch,
    urls_detected: bool,
) -> dict:
    reasons: list[str] = []
    recommendations: list[str] = []
    score = 0
    severity = ThreatSeverity.LOW
    threat_type = ThreatType.NONE
    providers = {
        "gemini": {
            "available": gemini.available,
            "error": gemini.error,
        },
        "virustotal": {
            "available": all(u.available for u in url_results) if url_results else True,
            "urls_scanned": len(url_results),
            "errors": [u.error for u in url_results if u.error],
        },
        "community": {
            "matched": community.matched,
            "report_count": community.report_count,
        },
    }

    gemini_ok = gemini.available
    vt_needed = urls_detected
    vt_ok = (not vt_needed) or (bool(url_results) and all(u.available for u in url_results))

    if gemini_ok:
        score = gemini.risk_score or 0
        severity = gemini.severity or _severity_from_score(score)
        threat_type = gemini.threat_type or ThreatType.OTHER
        reasons.extend(gemini.reasons)
        recommendations.extend(gemini.recommendations)
    else:
        reasons.append("Analyse sémantique indisponible (Gemini)")

    for url_res in url_results:
        if not url_res.available:
            reasons.append(f"Analyse VirusTotal indisponible pour {url_res.domain or 'une URL'}")
            continue
        if url_res.result == VirusTotalResult.MALICIOUS:
            score = max(score, 90)
            severity = _max_severity(severity, ThreatSeverity.HIGH)
            threat_type = ThreatType.MALICIOUS_LINK
            reasons.append(
                f"Lien malveillant détecté ({url_res.domain or url_res.url}) "
                f"— {url_res.malicious_count} moteur(s)"
            )
            recommendations.append("Ne pas cliquer sur le lien")
            recommendations.append("Ne pas transmettre d'informations personnelles")
        elif url_res.result == VirusTotalResult.SUSPICIOUS:
            score = max(score, 60)
            severity = _max_severity(severity, ThreatSeverity.MEDIUM)
            if threat_type == ThreatType.NONE:
                threat_type = ThreatType.MALICIOUS_LINK
            reasons.append(f"Lien suspect détecté ({url_res.domain or url_res.url})")
            recommendations.append("Éviter d'ouvrir le lien")

    if community.matched:
        boost = min(40, 10 + community.report_count * 5)
        score = min(100, max(score, 50) + boost // 2)
        if community.severity:
            severity = _max_severity(severity, community.severity)
        reasons.append(
            f"Contenu déjà signalé par la communauté "
            f"({community.report_count} signalement(s))"
        )
        recommendations.append("Traiter ce message avec une grande prudence")

    # Dédupliquer en conservant l'ordre
    reasons = list(dict.fromkeys(reasons))
    recommendations = list(dict.fromkeys(recommendations))
    if not recommendations and score >= 35:
        recommendations = [
            "Ne pas répondre au message",
            "Ne pas cliquer sur les liens",
            "Ne fournir aucune information personnelle",
        ]

    score = max(0, min(100, int(score)))
    severity = _max_severity(severity, _severity_from_score(score))

    # Indisponibilité : jamais SAFE par défaut
    if not gemini_ok and (not vt_needed or not vt_ok) and not community.matched:
        status = AnalysisStatus.UNKNOWN
        if score == 0:
            score = 50
            severity = ThreatSeverity.MEDIUM
            reasons.append("Impossible de conclure faute de sources d'analyse")
    elif not gemini_ok or (vt_needed and not vt_ok):
        status = AnalysisStatus.PARTIAL
        # Si on a déjà un signal fort, conserver DANGEROUS/SUSPICIOUS
        provisional = _status_from_score(score)
        if provisional in (AnalysisStatus.DANGEROUS, AnalysisStatus.SUSPICIOUS):
            status = provisional
        elif community.matched and score >= 35:
            status = AnalysisStatus.SUSPICIOUS
        if score < 35 and status == AnalysisStatus.PARTIAL:
            # Ne pas afficher SAFE partiel
            score = max(score, 40)
            severity = _max_severity(severity, ThreatSeverity.MEDIUM)
    else:
        status = _status_from_score(score)

    if threat_type == ThreatType.NONE and status != AnalysisStatus.SAFE:
        threat_type = ThreatType.OTHER

    return {
        "status": status,
        "risk_score": score,
        "severity": severity,
        "threat_type": threat_type,
        "reasons": reasons,
        "recommendations": recommendations,
        "providers": providers,
    }
