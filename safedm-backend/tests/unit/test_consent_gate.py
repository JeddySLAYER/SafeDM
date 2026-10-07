"""Tests du consentement explicite avant tout appel externe.

Contexte : avant ce garde-fou, `AnalysisService.analyze()` interrogeait Jev
inconditionnellement. Comme le `NotificationListenerService` appelle
`analyze()` pour **chaque** notification recue, chaque SMS de l'utilisateur
partait chez un tiers sans qu'il l'ait demande. Ces tests verrouillent la
correction.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from app.models.enums import ThreatSeverity
from app.repositories.threat_repository import ThreatRepository
from app.schemas.analysis import AnalysisRequest, CommunityMatch, UrlGateRequest
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.analysis_service import AnalysisService
from app.services.semantic_types import SemanticResult


def _service(*, community: CommunityMatch | None = None) -> AnalysisService:
    """Service dont les deux fournisseurs sont observables et muets."""
    db = MagicMock()
    jev = MagicMock()
    jev.analyze = MagicMock(
        return_value=SemanticResult(
            available=True,
            risk_score=95,
            severity=ThreatSeverity.CRITICAL,
            threat_type=ThreatType.PHISHING,
            confidence=0.99,
        )
    )
    virustotal = MagicMock()
    virustotal.scan_urls = MagicMock(return_value=[])

    service = AnalysisService(db=db, jev=jev, virustotal=virustotal)
    repo = ThreatRepository(db)
    repo.find_by_hashes = MagicMock(
        return_value=community
        or CommunityMatch(matched=False, raw_hash="a", normalized_hash="b")
    )
    repo.find_by_url = MagicMock(
        return_value=community
        or CommunityMatch(matched=False, raw_hash="a", normalized_hash="b")
    )
    service.threats = repo
    service._jev = jev
    service._virustotal = virustotal
    return service


def test_no_consent_means_jev_is_not_called() -> None:
    """Le coeur du correctif : sans consentement, Jev ne voit rien."""
    service = _service()

    service.analyze(
        AnalysisRequest(content="URGENT: validez votre mot de passe http://bit.ly/a3")
    )

    service._jev.analyze.assert_not_called()


def test_no_consent_means_virustotal_is_not_called() -> None:
    """VirusTotal reçoit l'URL, qui fait partie du contenu. Meme regle."""
    service = _service()

    service.analyze(
        AnalysisRequest(content="cliquez http://bit.ly/a3 pour votre offre")
    )

    service._virustotal.scan_urls.assert_not_called()


def test_no_consent_never_claims_the_message_is_safe() -> None:
    """Le piege : sans analyseur, conclure SAFE serait une affirmation de
    securite non etayee. Le statut doit rester UNKNOWN.
    """
    service = _service()

    result = service.analyze(AnalysisRequest(content="Bonjour, tout va bien ?"))

    assert result.status is AnalysisStatus.UNKNOWN, (
        "un message non analyse ne doit jamais etre declare SAFE"
    )
    assert result.status is not AnalysisStatus.SAFE


def test_no_consent_reports_the_skipped_providers() -> None:
    """Le client doit pouvoir afficher pourquoi il n'a pas eu de verdict."""
    service = _service()

    result = service.analyze(AnalysisRequest(content="Bonjour, comment vas-tu ?"))

    assert result.providers["jev"]["skipped"] is True
    assert result.providers["virustotal"]["skipped"] is True
    assert "consentement" in result.providers["jev"]["reason"].lower()


def test_no_consent_still_warns_about_detected_links() -> None:
    """Le contenu est analyse hors ligne : on peut signaler une URL sans l'envoyer."""
    service = _service()

    result = service.analyze(
        AnalysisRequest(content="cliquez http://bit.ly/a3 pour votre offre")
    )

    assert any("lien" in reason.lower() for reason in result.reasons), (
        "une URL non verifiee doit etre signalee a l'utilisateur"
    )


def test_no_consent_still_honours_a_community_report() -> None:
    """Les empreintes ne sortent pas le contenu : la communaute reste consultable.

    Un message deja signale doit rester dangereux meme sans consentement,
    sinon on laisserait passer une menace deja connue.
    """
    service = _service(
        community=CommunityMatch(
            matched=True,
            raw_hash="a",
            normalized_hash="b",
            report_count=4,
            severity=ThreatSeverity.CRITICAL,
        )
    )

    result = service.analyze(AnalysisRequest(content="message deja signale"))

    assert result.status is AnalysisStatus.DANGEROUS
    assert result.risk_score >= 80
    service._jev.analyze.assert_not_called()


def test_consent_calls_jev_and_discovers_urls() -> None:
    """Le chemin nominal fonctionne toujours quand le consentement est donne."""
    service = _service()

    service.analyze(
        AnalysisRequest(
            content="URGENT: validez votre mot de passe http://bit.ly/a3",
            consent_external=True,
        )
    )

    service._jev.analyze.assert_called_once()


def test_url_gate_without_consent_is_not_scanned() -> None:
    """Le Link Gate refuse aussi par defaut."""
    service = _service()

    result = service.analyze_url(UrlGateRequest(url="http://bit.ly/a3"))

    service._virustotal.scan_urls.assert_not_called()
    service._jev.analyze.assert_not_called()
    assert result.status is AnalysisStatus.UNKNOWN
    assert result.url == "http://bit.ly/a3", "la reponse doit rester exploitable"


def test_url_gate_without_consent_blocks_a_known_bad_url() -> None:
    """Un lien deja signale reste bloque, meme sans appel externe."""
    service = _service(
        community=CommunityMatch(
            matched=True,
            raw_hash="a",
            normalized_hash="b",
            report_count=2,
            severity=ThreatSeverity.HIGH,
        )
    )

    result = service.analyze_url(UrlGateRequest(url="http://bit.ly/a3"))

    assert result.status is AnalysisStatus.DANGEROUS
    assert result.decision == "BLOCK", "un lien connu dangereux doit etre bloque"


def test_url_gate_with_consent_scans() -> None:
    service = _service()

    service.analyze_url(
        UrlGateRequest(url="http://bit.ly/a3", consent_external=True)
    )

    service._virustotal.scan_urls.assert_called_once_with(["http://bit.ly/a3"])