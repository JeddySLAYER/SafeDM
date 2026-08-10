"""Gemini 2.5 Flash semantic analysis via REST (httpx)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import httpx

from app.core.config import Settings, get_settings
from app.models.enums import ThreatSeverity
from app.schemas.analysis_enums import ThreatType
from app.services.gemini_types import GeminiResult

logger = logging.getLogger(__name__)

_GEMINI_PROMPT = """Tu es un moteur d'analyse de cybersécurité pour SafeDM.
Analyse le message suivant et détecte phishing, ingénierie sociale, urgence suspecte,
demandes sensibles, liens dangereux ou autres arnaques.

Réponds UNIQUEMENT avec un JSON valide (sans markdown) de la forme:
{{
  "risk_score": 0-100,
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "threat_type": "PHISHING|SOCIAL_ENGINEERING|URGENT_ACTION|SUSPICIOUS_REQUEST|MALICIOUS_LINK|SENSITIVE_DATA_REQUEST|OTHER|NONE",
  "reasons": ["..."],
  "recommendations": ["..."]
}}

Message à analyser (ne répète pas le contenu dans ta réponse):
\"\"\"{content}\"\"\"
"""


class GeminiService:
    def __init__(
        self,
        settings: Optional[Settings] = None,
        client: Optional[httpx.Client] = None,
    ):
        self.settings = settings or get_settings()
        self._client = client

    def analyze(self, content: str) -> GeminiResult:
        if self.settings.analysis_demo_mode and not self.settings.gemini_api_key:
            from app.services.demo_providers import demo_gemini_analyze

            logger.warning("Gemini running in ANALYSIS_DEMO_MODE")
            return demo_gemini_analyze(content)

        if not self.settings.gemini_api_key:
            logger.warning("Gemini API key missing — analysis unavailable")
            return GeminiResult(
                available=False,
                error="GEMINI_API_KEY_MISSING",
            )

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": _GEMINI_PROMPT.format(content=content[:15000])}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }

        try:
            client = self._client or httpx.Client(timeout=self.settings.gemini_timeout_seconds)
            close_client = self._client is None
            try:
                response = client.post(
                    url,
                    params={"key": self.settings.gemini_api_key},
                    json=payload,
                )
            finally:
                if close_client:
                    client.close()

            if response.status_code >= 400:
                logger.error("Gemini HTTP error status=%s", response.status_code)
                return GeminiResult(
                    available=False,
                    error=f"GEMINI_HTTP_{response.status_code}",
                )

            data = response.json()
            text = self._extract_text(data)
            parsed = self._parse_json(text)
            if parsed is None:
                return GeminiResult(
                    available=False,
                    error="GEMINI_INVALID_JSON",
                    raw=data,
                )
            return self._to_result(parsed, data)
        except httpx.TimeoutException:
            logger.error("Gemini timeout")
            return GeminiResult(available=False, error="GEMINI_TIMEOUT")
        except httpx.HTTPError:
            logger.error("Gemini network error")
            return GeminiResult(available=False, error="GEMINI_NETWORK_ERROR")
        except Exception:
            logger.exception("Gemini unexpected error")
            return GeminiResult(available=False, error="GEMINI_UNEXPECTED_ERROR")

    def _extract_text(self, data: dict[str, Any]) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts") or []
        return "".join(part.get("text", "") for part in parts)

    def _parse_json(self, text: str) -> dict[str, Any] | None:
        if not text:
            return None
        cleaned = text.strip()
        fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if fence:
            cleaned = fence.group(1)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(cleaned[start : end + 1])
                except json.JSONDecodeError:
                    return None
            return None

    def _to_result(self, parsed: dict[str, Any], raw: dict[str, Any]) -> GeminiResult:
        severity_raw = str(parsed.get("severity", "LOW")).upper()
        threat_raw = str(parsed.get("threat_type", "OTHER")).upper()
        try:
            severity = ThreatSeverity(severity_raw)
        except ValueError:
            severity = ThreatSeverity.MEDIUM
        try:
            threat_type = ThreatType(threat_raw)
        except ValueError:
            threat_type = ThreatType.OTHER

        score = parsed.get("risk_score", 0)
        try:
            score_int = max(0, min(100, int(score)))
        except (TypeError, ValueError):
            score_int = 50

        reasons = parsed.get("reasons") or []
        recommendations = parsed.get("recommendations") or []
        if not isinstance(reasons, list):
            reasons = [str(reasons)]
        if not isinstance(recommendations, list):
            recommendations = [str(recommendations)]

        return GeminiResult(
            available=True,
            risk_score=score_int,
            severity=severity,
            threat_type=threat_type,
            reasons=[str(r) for r in reasons][:10],
            recommendations=[str(r) for r in recommendations][:10],
            raw=raw,
        )
