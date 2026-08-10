"""Tests Sprint 3 — pipeline d'analyse (fusion, URLs, endpoint)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import ThreatSeverity, VirusTotalResult
from app.schemas.analysis import CommunityMatch, UrlAnalysisResult
from app.schemas.analysis_enums import AnalysisStatus, ThreatType
from app.services.analysis_service import AnalysisService
from app.services.fusion_service import fuse_analysis
from app.services.gemini_types import GeminiResult
from app.utils.hashing import compute_normalized_hash, compute_raw_hash
from app.utils.url_extraction import extract_urls

client = TestClient(app)


def _unique_username() -> str:
    return f"an_{uuid.uuid4().hex[:10]}"


@pytest.fixture
def auth_headers():
    username = _unique_username()
    password = "SecurePass1"
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_extract_multiple_urls():
    text = "Voir https://evil.example/a et www.phish.test/login puis https://evil.example/a"
    urls = extract_urls(text)
    assert len(urls) == 2
    assert urls[0] == "https://evil.example/a"
    assert urls[1].startswith("https://www.phish.test")


def test_hashes_stable_and_normalized():
    raw = "Urgent: cliquez ICI https://x.test"
    assert len(compute_raw_hash(raw)) == 64
    assert compute_normalized_hash(raw) == compute_normalized_hash(
        "urgent: cliquez ici https://y.test"
    )


def test_fusion_vt_malicious_overrides_medium_gemini():
    gemini = GeminiResult(
        available=True,
        risk_score=40,
        severity=ThreatSeverity.MEDIUM,
        threat_type=ThreatType.SUSPICIOUS_REQUEST,
        reasons=["Demande suspecte"],
        recommendations=["Ne pas répondre"],
    )
    urls = [
        UrlAnalysisResult(
            url="https://evil.test",
            domain="evil.test",
            available=True,
            result=VirusTotalResult.MALICIOUS,
            malicious_count=5,
        )
    ]
    fused = fuse_analysis(
        gemini=gemini,
        url_results=urls,
        community=CommunityMatch(matched=False),
        urls_detected=True,
    )
    assert fused["status"] == AnalysisStatus.DANGEROUS
    assert fused["risk_score"] >= 90
    assert fused["severity"] in (ThreatSeverity.HIGH, ThreatSeverity.CRITICAL)


def test_fusion_providers_down_never_safe():
    gemini = GeminiResult(available=False, error="GEMINI_TIMEOUT")
    urls = [
        UrlAnalysisResult(
            url="https://x.test",
            domain="x.test",
            available=False,
            result=VirusTotalResult.UNKNOWN,
            error="VIRUSTOTAL_TIMEOUT",
        )
    ]
    fused = fuse_analysis(
        gemini=gemini,
        url_results=urls,
        community=CommunityMatch(matched=False),
        urls_detected=True,
    )
    assert fused["status"] in (AnalysisStatus.UNKNOWN, AnalysisStatus.PARTIAL)
    assert fused["status"] != AnalysisStatus.SAFE


def test_fusion_partial_when_only_gemini_down_but_vt_clean():
    gemini = GeminiResult(available=False, error="GEMINI_API_KEY_MISSING")
    urls = [
        UrlAnalysisResult(
            url="https://ok.test",
            domain="ok.test",
            available=True,
            result=VirusTotalResult.CLEAN,
        )
    ]
    fused = fuse_analysis(
        gemini=gemini,
        url_results=urls,
        community=CommunityMatch(matched=False),
        urls_detected=True,
    )
    assert fused["status"] == AnalysisStatus.PARTIAL
    assert fused["status"] != AnalysisStatus.SAFE


def test_analysis_insufficient_content(auth_headers):
    response = client.post(
        "/api/v1/analysis",
        headers=auth_headers,
        json={"content": "hi", "source": "MANUAL"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INSUFFICIENT_CONTENT"
    assert body["content_stored"] is False


def test_analysis_endpoint_with_mocked_providers(auth_headers, monkeypatch):
    gemini = GeminiResult(
        available=True,
        risk_score=80,
        severity=ThreatSeverity.HIGH,
        threat_type=ThreatType.PHISHING,
        reasons=["Demande d'action urgente", "Présence d'un lien"],
        recommendations=["Ne pas cliquer sur le lien"],
    )
    vt_result = [
        UrlAnalysisResult(
            url="https://bank-secure-login.test/reset",
            domain="bank-secure-login.test",
            available=True,
            result=VirusTotalResult.MALICIOUS,
            malicious_count=12,
        )
    ]

    class FakeGemini:
        def analyze(self, content: str):
            assert "Urgent" in content
            return gemini

    class FakeVT:
        def scan_urls(self, urls: list[str]):
            assert len(urls) == 1
            return vt_result

    original = AnalysisService.analyze

    def patched_analyze(self, payload):
        self.gemini = FakeGemini()
        self.virustotal = FakeVT()
        return original(self, payload)

    monkeypatch.setattr(AnalysisService, "analyze", patched_analyze)

    response = client.post(
        "/api/v1/analysis",
        headers=auth_headers,
        json={
            "content": "Urgent: validez votre compte https://bank-secure-login.test/reset",
            "source": "MANUAL",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "DANGEROUS"
    assert body["risk_score"] >= 80
    assert body["content_stored"] is False
    assert body["threat_type"] in ("PHISHING", "MALICIOUS_LINK")
    assert len(body["urls"]) == 1
    assert body["urls"][0]["result"] == "MALICIOUS"


def test_analysis_requires_auth():
    response = client.post(
        "/api/v1/analysis",
        json={"content": "Un message assez long pour passer le seuil"},
    )
    assert response.status_code == 401


def test_analysis_service_unit_no_persist():
    db = MagicMock()
    # Threat lookup returns no match
    from app.repositories.threat_repository import ThreatRepository

    repo = ThreatRepository(db)
    repo.find_by_hashes = MagicMock(  # type: ignore[method-assign]
        return_value=CommunityMatch(matched=False, raw_hash="a", normalized_hash="b")
    )

    service = AnalysisService(
        db=db,
        gemini=MagicMock(
            analyze=MagicMock(
                return_value=GeminiResult(
                    available=True,
                    risk_score=10,
                    severity=ThreatSeverity.LOW,
                    threat_type=ThreatType.NONE,
                    reasons=[],
                    recommendations=[],
                )
            )
        ),
        virustotal=MagicMock(scan_urls=MagicMock(return_value=[])),
    )
    service.threats = repo

    from app.schemas.analysis import AnalysisRequest
    from app.schemas.analysis_enums import AnalysisSource

    result = service.analyze(
        AnalysisRequest(
            content="Bonjour, voici un message bénin sans lien.",
            source=AnalysisSource.MANUAL,
        )
    )
    assert result.content_stored is False
    assert result.status == AnalysisStatus.SAFE
    db.add.assert_not_called()
    db.commit.assert_not_called()
