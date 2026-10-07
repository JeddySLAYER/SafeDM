"""Tests Sprint 10 — Jev (System One) : score calibre et routage par confiance.

Ces tests ne touchent pas le reseau : ils injectent de fausses reponses Jev avec
la forme exacte du SDK (`ChoiceAnswer`, `NoulAnswer`, `ScoreAnswer`) pour valider
la conversion en `SemanticResult` et l'effet de `confidence` sur la fusion.
"""

from types import SimpleNamespace

import pytest

from app.models.enums import ThreatSeverity
from app.schemas.analysis import CommunityMatch
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.fusion_service import fuse_analysis
from app.services.jev_service import JevService
from app.services.semantic_types import SemanticResult

PHISHING_MESSAGE = (
    "URGENT: votre carte OrangeMoney est bloquee. "
    "Validez votre compte et saisissez votre code ici: http://bit.ly/3xKm9p"
)
BENIGN_MESSAGE = "Bonjour, votre commande est arrivee. Bonsoir."


def _choice(choice: str, probabilities: dict, confidence: float):
    """Reproduit la forme d'un ChoiceAnswer du SDK."""
    return SimpleNamespace(
        type="choice", choice=choice, confidence=confidence, probabilities=probabilities
    )


def _noul(probability: float):
    return SimpleNamespace(type="noul", noul=probability)


def _score(level: int, confidence: float = 0.8):
    return SimpleNamespace(
        type="score",
        score=level,
        confidence=confidence,
        legend=["a", "b", "c", "d", "e"],
        probabilities={},
    )


def _response(verdict, **extra):
    answers = {"verdict": verdict}
    answers.update(extra)
    return SimpleNamespace(
        model="jev-1.13.0",
        answers=answers,
        usage=SimpleNamespace(input_tokens=420, output_tokens=90),
    )


class _FakeClient:
    """Client TypeSafe injectable, qui retourne une reponsepreparee."""

    def __init__(self, response=None, error=None):
        self._response = response
        self._error = error
        self.calls: list[dict] = []

    def system_one(self, *, state, questions, model=None):
        self.calls.append({"state": state, "questions": questions, "model": model})
        if self._error is not None:
            raise self._error
        return self._response


def _service(response=None, error=None, **settings):
    from app.core.config import Settings

    base = {
        "typesafe_api_key": "test-key",
        "typesafe_model": "jev-latest",
        "typesafe_timeout_seconds": 15,
        "typesafe_max_content_chars": 6000,
        "analysis_demo_mode": False,
    }
    base.update(settings)
    client = _FakeClient(response=response, error=error)
    return JevService(settings=Settings(**base), client=client), client


# --------------------------------------------------------------- conversion


def test_risk_score_is_sum_of_malicious_probabilities():
    """Le score doit venir des probabilites, pas d'un entier invente."""
    service, _ = _service(
        response=_response(
            verdict=_choice(
                "phishing",
                {"phishing": 0.80, "social_engineering": 0.05, "scam_financial": 0.03,
                 "legitimate": 0.04, "benign_marketing": 0.03, "none": 0.05},
                confidence=0.91,
            ),
            urgency=_score(3),
            credential_request=_noul(0.97),
            sensitive_data_request=_noul(0.62),
            link_deception=_noul(0.88),
        )
    )

    result = service.analyze(PHISHING_MESSAGE, ["http://bit.ly/3xKm9p"])

    assert result.available is True
    # 0.80 + 0.05 + 0.03 = 0.88 -> 88
    assert result.risk_score == 88
    assert result.confidence == pytest.approx(0.91)
    assert result.threat_type == ThreatType.PHISHING


def test_benign_message_maps_to_none_and_low_score():
    service, _ = _service(
        response=_response(
            verdict=_choice(
                "legitimate",
                {"phishing": 0.01, "social_engineering": 0.01, "scam_financial": 0.01,
                 "legitimate": 0.95, "benign_marketing": 0.01, "none": 0.01},
                confidence=0.88,
            ),
            urgency=_score(0),
            credential_request=_noul(0.02),
            sensitive_data_request=_noul(0.01),
            link_deception=_noul(0.03),
        )
    )

    result = service.analyze(BENIGN_MESSAGE, [])

    assert result.risk_score == 3
    assert result.threat_type == ThreatType.NONE
    assert result.confidence == pytest.approx(0.88)


def test_confident_phishing_yields_actionable_reasons_and_advice():
    service, _ = _service(
        response=_response(
            verdict=_choice(
                "phishing",
                {"phishing": 0.95, "social_engineering": 0.02, "scam_financial": 0.01,
                 "legitimate": 0.01, "benign_marketing": 0.005, "none": 0.005},
                confidence=0.93,
            ),
            urgency=_score(4),
            credential_request=_noul(0.99),
            sensitive_data_request=_noul(0.71),
            link_deception=_noul(0.94),
        )
    )

    result = service.analyze(PHISHING_MESSAGE, ["http://bit.ly/3xKm9p"])
    joined = " ".join(result.reasons)

    assert any("Phishing" in r for r in result.reasons)
    assert "Urgence de niveau 4/4" in joined
    assert any("identifiants" in r for r in result.reasons)
    assert any("données sensibles" in r for r in result.reasons)
    assert result.recommendations


def test_urls_are_forwarded_to_state_for_link_deception():
    """Les URLs doivent atteindre Jev dans `state`, sans second aller-retour."""
    urls = ["http://bit.ly/3xKm9p", "https://banque-fake.tg/login"]
    service, client = _service(
        response=_response(
            verdict=_choice(
                "phishing",
                {"phishing": 0.9, "social_engineering": 0.0, "scam_financial": 0.0,
                 "legitimate": 0.02, "benign_marketing": 0.03, "none": 0.05},
                confidence=0.9,
            )
        )
    )

    service.analyze(PHISHING_MESSAGE, urls)

    assert len(client.calls) == 1
    assert client.calls[0]["state"]["urls"] == urls
    # Les 5 questions partent dans le meme appel.
    assert set(client.calls[0]["questions"]) == {
        "verdict",
        "urgency",
        "credential_request",
        "sensitive_data_request",
        "link_deception",
    }


def test_content_is_truncated_to_configured_budget():
    long_message = "A" * 20_000
    service, client = _service(
        response=_response(
            verdict=_choice(
                "legitimate",
                {"phishing": 0.0, "social_engineering": 0.0, "scam_financial": 0.0,
                 "legitimate": 1.0, "benign_marketing": 0.0, "none": 0.0},
                confidence=0.9,
            )
        )
    )

    service.analyze(long_message, [])

    assert len(client.calls[0]["state"]["message"]) == 6000


# ------------------------------------------------------------- echecs degrades


def test_missing_api_key_degrades_without_calling_api():
    service, client = _service(typesafe_api_key="")

    result = service.analyze(PHISHING_MESSAGE, [])

    assert result.available is False
    assert result.error == "TYPESAFE_API_KEY_MISSING"
    assert client.calls == []


def test_analyze_features_missing_api_key_degrades_without_calling_api():
    service, client = _service(typesafe_api_key="")

    result = service.analyze_features([0] * 50)

    assert result.available is False
    assert result.error == "TYPESAFE_API_KEY_MISSING"
    assert client.calls == []


def test_malformed_answer_degrades_gracefully():
    """Une reponse sans `verdict` ne doit jamais lever : elle degrade."""
    service, _ = _service(response=SimpleNamespace(model="jev-1.13.0", answers={}, usage=None))

    result = service.analyze(PHISHING_MESSAGE, [])

    assert result.available is False
    assert result.error == "TYPESAFE_MALFORMED_ANSWER"


def test_api_error_is_captured_as_unavailable():
    from typesafe_sdk import TypeSafeAPITimeoutError

    service, _ = _service(error=TypeSafeAPITimeoutError("boom"))

    result = service.analyze(PHISHING_MESSAGE, [])

    assert result.available is False
    assert result.error == "TYPESAFE_TIMEOUT"


# ------------------------------------------- routage par confiance (fusion)


def _fuse(semantic: SemanticResult):
    return fuse_analysis(
        semantic=semantic,
        url_results=[],
        community=CommunityMatch(matched=False),
        urls_detected=False,
    )


def test_low_confidence_never_reaches_safe():
    """Le principe central du Sprint 10 : un juge incertain ne rehabilite pas SAFE."""
    semantic = SemanticResult(
        available=True,
        risk_score=5,
        confidence=0.21,
        threat_type=ThreatType.NONE,
    )

    fused = _fuse(semantic)

    assert fused["status"] != AnalysisStatus.SAFE
    assert fused["status"] == AnalysisStatus.PARTIAL
    assert fused["risk_score"] >= 35
    assert fused["severity"] in (ThreatSeverity.MEDIUM, ThreatSeverity.HIGH)
    assert any("peu confiant" in r for r in fused["reasons"])


def test_low_confidence_does_not_downgrade_a_strong_threat():
    """L'incertitude ne doit jamais affaiblir un signal fort deja etabli."""
    semantic = SemanticResult(
        available=True,
        risk_score=95,
        confidence=0.22,
        threat_type=ThreatType.PHISHING,
    )

    fused = _fuse(semantic)

    assert fused["status"] == AnalysisStatus.DANGEROUS
    assert fused["risk_score"] == 95


def test_high_confidence_allows_safe():
    semantic = SemanticResult(
        available=True,
        risk_score=4,
        confidence=0.93,
        threat_type=ThreatType.NONE,
    )

    fused = _fuse(semantic)

    assert fused["status"] == AnalysisStatus.SAFE


def test_confidence_is_exposed_in_providers():
    semantic = SemanticResult(available=True, risk_score=10, confidence=0.77)

    fused = _fuse(semantic)

    assert fused["providers"]["jev"]["confidence"] == pytest.approx(0.77)
    assert "gemini" not in fused["providers"]