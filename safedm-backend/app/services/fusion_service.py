"""Fusion Jev + VirusTotal + communauté -> score final.

Les seuils de décision sont lus dans la configuration (env) et non codes en dur :
ils sont de la politique produit, appeles a bouger apres le benchmark, et un
seuil fige dans le source est impossible a ajuster sans redeloiement.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.models.enums import ThreatSeverity, VirusTotalResult
from app.schemas.analysis import CommunityMatch, UrlAnalysisResult
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.semantic_types import SemanticResult

_SEVERITY_RANK = {
    ThreatSeverity.LOW: 1,
    ThreatSeverity.MEDIUM: 2,
    ThreatSeverity.HIGH: 3,
    ThreatSeverity.CRITICAL: 4,
}


def _thresholds() -> dict[str, float]:
    """Seuils de decision, surchargeables par variables d'environnement.

    Valeurs par defaut = table de decision de l'architecture V2, recalees par le
    benchmark du 2026-10-02 sur 28 SMS francais/togolais.
    """
    s = get_settings()
    return {
        # En dessous, le verdict est trop ambigu pour rehabiliter un SAFE.
        # Le benchmark a montre que 0.40 ne couvrait que 3 erreurs sur 14 ;
        # 0.65 en couvre 7 tout en n'escaladant que 9 messages sur 28.
        "uncertainty": s.threshold_uncertainty_confidence,
        "escalation": s.threshold_escalation_confidence,
        "safe": s.threshold_safe_score,
        "suspicious": s.threshold_suspicious_score,
        "critical": s.threshold_critical_score,
        "uncertain_score_floor": s.uncertain_score_floor,
    }


def _severity_from_score(score: int) -> ThreatSeverity:
    t = _thresholds()
    if score >= t["critical"]:
        return ThreatSeverity.CRITICAL
    if score >= t["suspicious"]:
        return ThreatSeverity.HIGH
    if score >= t["safe"]:
        return ThreatSeverity.MEDIUM
    return ThreatSeverity.LOW


def _max_severity(a: ThreatSeverity, b: ThreatSeverity) -> ThreatSeverity:
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


def _status_from_score(score: int) -> AnalysisStatus:
    t = _thresholds()
    if score >= t["suspicious"]:
        return AnalysisStatus.DANGEROUS
    if score >= t["safe"]:
        return AnalysisStatus.SUSPICIOUS
    return AnalysisStatus.SAFE


def fuse_analysis(
    *,
    semantic: SemanticResult,
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
        "jev": {
            "available": semantic.available,
            "error": semantic.error,
            "confidence": semantic.confidence,
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

    semantic_ok = semantic.available
    vt_needed = urls_detected
    vt_ok = (not vt_needed) or (bool(url_results) and all(u.available for u in url_results))

    if semantic_ok:
        score = semantic.risk_score or 0
        severity = semantic.severity or _severity_from_score(score)
        threat_type = semantic.threat_type or ThreatType.OTHER
        reasons.extend(semantic.reasons)
        recommendations.extend(semantic.recommendations)
    else:
        reasons.append("Analyse sémantique indisponible (Jev)")

    # Routage par confiance (V2). Jev expose une probabilite d'incertitude reelle :
    # `confidence` resume la dispersion de la distribution du verdict.
    # Un juge peu sur de lui ne doit jamais produire un SAFE affirmatif.
    semantic_uncertain = False
    if semantic_ok and semantic.confidence is not None:
        if semantic.confidence < _thresholds()["uncertainty"]:
            semantic_uncertain = True
            reasons.append(
                f"Jev peu confiant sur ce message (confiance {semantic.confidence:.2f}) "
                f"– vérification recommandée"
            )

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
    t = _thresholds()
    floor = int(t["safe"])
    reasons = list(dict.fromkeys(reasons))
    recommendations = list(dict.fromkeys(recommendations))
    if not recommendations and score >= floor:
        recommendations = [
            "Ne pas répondre au message",
            "Ne pas cliquer sur les liens",
            "Ne fournir aucune information personnelle",
        ]

    score = max(0, min(100, int(score)))
    severity = _max_severity(severity, _severity_from_score(score))

    # Indisponibilité : jamais SAFE par défaut
    if not semantic_ok and (not vt_needed or not vt_ok) and not community.matched:
        status = AnalysisStatus.UNKNOWN
        if score == 0:
            score = 50
            severity = ThreatSeverity.MEDIUM
            reasons.append("Impossible de conclure faute de sources d'analyse")
    elif not semantic_ok or (vt_needed and not vt_ok):
        status = AnalysisStatus.PARTIAL
        # Si on a déjà un signal fort, conserver DANGEROUS/SUSPICIOUS
        provisional = _status_from_score(score)
        if provisional in (AnalysisStatus.DANGEROUS, AnalysisStatus.SUSPICIOUS):
            status = provisional
        elif community.matched and score >= floor:
            status = AnalysisStatus.SUSPICIOUS
        if score < floor and status == AnalysisStatus.PARTIAL:
            # Ne pas afficher SAFE partiel
            score = max(score, int(t["uncertain_score_floor"]))
            severity = _max_severity(severity, ThreatSeverity.MEDIUM)
    else:
        status = _status_from_score(score)

    # Un juge incertain ne peut pas rehabiliter un SAFE. On degrade en PARTIAL
    # et on releve le plancher, afin que le mobile redemande a l'utilisateur.
    if semantic_uncertain and status == AnalysisStatus.SAFE:
        status = AnalysisStatus.PARTIAL
        if score < int(t["uncertain_score_floor"]):
            score = int(t["uncertain_score_floor"])
            severity = _max_severity(severity, ThreatSeverity.MEDIUM)

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
