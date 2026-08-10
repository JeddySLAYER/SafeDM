"""Deterministic demo providers for local Sprint 3 validation without API keys."""

from __future__ import annotations

from app.models.enums import ThreatSeverity, VirusTotalResult
from app.schemas.analysis import UrlAnalysisResult
from app.schemas.analysis_enums import ThreatType
from app.services.gemini_types import GeminiResult
from app.utils.url_extraction import extract_domain

_URGENT = ("urgent", "immédiat", "immediat", "sous 24h", "dernier avertissement")
_PHISH = ("mot de passe", "password", "otp", "code de vérification", "validez votre compte", "cliquez")
_SENSITIVE = ("rib", "carte bancaire", "numéro de carte", "cvv", "sécurité sociale")


def demo_gemini_analyze(content: str) -> GeminiResult:
    text = content.lower()
    score = 15
    reasons: list[str] = []
    threat_type = ThreatType.NONE

    if any(k in text for k in _URGENT):
        score += 30
        reasons.append("Demande d'action urgente")
        threat_type = ThreatType.URGENT_ACTION
    if any(k in text for k in _PHISH):
        score += 35
        reasons.append("Indices de phishing / demande de validation")
        threat_type = ThreatType.PHISHING
    if any(k in text for k in _SENSITIVE):
        score += 25
        reasons.append("Demande d'informations sensibles")
        threat_type = ThreatType.SENSITIVE_DATA_REQUEST
    if "http://" in text or "https://" in text or "www." in text:
        score += 15
        reasons.append("Présence d'un lien externe")
        if threat_type == ThreatType.NONE:
            threat_type = ThreatType.MALICIOUS_LINK

    score = min(100, score)
    if score >= 85:
        severity = ThreatSeverity.CRITICAL
    elif score >= 65:
        severity = ThreatSeverity.HIGH
    elif score >= 35:
        severity = ThreatSeverity.MEDIUM
    else:
        severity = ThreatSeverity.LOW

    recommendations = []
    if score >= 35:
        recommendations = [
            "Ne pas cliquer sur les liens",
            "Ne pas répondre au message",
            "Ne fournir aucune information personnelle",
        ]

    return GeminiResult(
        available=True,
        risk_score=score,
        severity=severity,
        threat_type=threat_type,
        reasons=reasons or ["Aucun signal fort détecté (mode démo)"],
        recommendations=recommendations,
        error=None,
        raw={"demo": True},
    )


def demo_virustotal_scan(url: str) -> UrlAnalysisResult:
    domain = extract_domain(url) or ""
    lowered = url.lower()
    suspicious_markers = ("login", "reset", "verify", "secure-", "account", "bank", "paypal")
    hits = sum(1 for m in suspicious_markers if m in lowered)

    if hits >= 2 or any(x in domain for x in ("phish", "evil", "malware")):
        return UrlAnalysisResult(
            url=url,
            domain=domain or None,
            available=True,
            result=VirusTotalResult.MALICIOUS,
            malicious_count=8,
            suspicious_count=2,
            harmless_count=1,
            error=None,
        )
    if hits == 1:
        return UrlAnalysisResult(
            url=url,
            domain=domain or None,
            available=True,
            result=VirusTotalResult.SUSPICIOUS,
            malicious_count=0,
            suspicious_count=3,
            harmless_count=10,
            error=None,
        )
    return UrlAnalysisResult(
        url=url,
        domain=domain or None,
        available=True,
        result=VirusTotalResult.CLEAN,
        malicious_count=0,
        suspicious_count=0,
        harmless_count=20,
        error=None,
    )
