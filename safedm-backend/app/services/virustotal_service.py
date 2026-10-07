"""VirusTotal URL analysis via REST (httpx)."""

from __future__ import annotations

import base64
import logging
from typing import Optional

import httpx

from app.core.config import Settings, get_settings
from app.models.enums import VirusTotalResult
from app.schemas.analysis import UrlAnalysisResult
from app.utils.url_extraction import extract_domain

logger = logging.getLogger(__name__)


class VirusTotalService:
    def __init__(
        self,
        settings: Optional[Settings] = None,
        client: Optional[httpx.Client] = None,
    ):
        self.settings = settings or get_settings()
        self._client = client

    def scan_url(self, url: str) -> UrlAnalysisResult:
        domain = extract_domain(url)
        if self.settings.analysis_demo_mode and not self.settings.virustotal_api_key:
            from app.services.demo_providers import demo_virustotal_scan

            logger.warning("VirusTotal running in ANALYSIS_DEMO_MODE")
            return demo_virustotal_scan(url)

        if not self.settings.virustotal_api_key:
            logger.warning("VirusTotal API key missing — URL scan unavailable")
            return UrlAnalysisResult(
                url=url,
                domain=domain,
                available=False,
                result=VirusTotalResult.UNKNOWN,
                error="VIRUSTOTAL_API_KEY_MISSING",
            )

        url_id = base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").strip("=")
        endpoint = f"{self.settings.virustotal_base_url.rstrip('/')}/urls/{url_id}"
        headers = {"x-apikey": self.settings.virustotal_api_key}

        try:
            client = self._client or httpx.Client(
                timeout=self.settings.virustotal_timeout_seconds
            )
            close_client = self._client is None
            try:
                response = client.get(endpoint, headers=headers)
                if response.status_code == 404:
                    # Soumettre l'URL puis relire
                    submit = client.post(
                        f"{self.settings.virustotal_base_url.rstrip('/')}/urls",
                        headers=headers,
                        data={"url": url},
                    )
                    if submit.status_code >= 400:
                        logger.error("VirusTotal submit HTTP %s", submit.status_code)
                        return UrlAnalysisResult(
                            url=url,
                            domain=domain,
                            available=False,
                            result=VirusTotalResult.UNKNOWN,
                            error=f"VIRUSTOTAL_SUBMIT_{submit.status_code}",
                        )
                    response = client.get(endpoint, headers=headers)
            finally:
                if close_client:
                    client.close()

            if response.status_code >= 400:
                logger.error("VirusTotal HTTP error status=%s", response.status_code)
                return UrlAnalysisResult(
                    url=url,
                    domain=domain,
                    available=False,
                    result=VirusTotalResult.UNKNOWN,
                    error=f"VIRUSTOTAL_HTTP_{response.status_code}",
                )

            data = response.json()
            stats = (
                data.get("data", {})
                .get("attributes", {})
                .get("last_analysis_stats", {})
            )
            malicious = int(stats.get("malicious", 0) or 0)
            suspicious = int(stats.get("suspicious", 0) or 0)
            harmless = int(stats.get("harmless", 0) or 0)

            if malicious > 0:
                result = VirusTotalResult.MALICIOUS
            elif suspicious > 0:
                result = VirusTotalResult.SUSPICIOUS
            elif harmless > 0:
                result = VirusTotalResult.CLEAN
            else:
                result = VirusTotalResult.UNKNOWN

            return UrlAnalysisResult(
                url=url,
                domain=domain,
                available=True,
                result=result,
                malicious_count=malicious,
                suspicious_count=suspicious,
                harmless_count=harmless,
            )
        except httpx.TimeoutException:
            logger.error("VirusTotal timeout")
            return UrlAnalysisResult(
                url=url,
                domain=domain,
                available=False,
                result=VirusTotalResult.UNKNOWN,
                error="VIRUSTOTAL_TIMEOUT",
            )
        except httpx.HTTPError:
            logger.error("VirusTotal network error")
            return UrlAnalysisResult(
                url=url,
                domain=domain,
                available=False,
                result=VirusTotalResult.UNKNOWN,
                error="VIRUSTOTAL_NETWORK_ERROR",
            )
        except Exception:
            logger.exception("VirusTotal unexpected error")
            return UrlAnalysisResult(
                url=url,
                domain=domain,
                available=False,
                result=VirusTotalResult.UNKNOWN,
                error="VIRUSTOTAL_UNEXPECTED_ERROR",
            )

    def scan_urls(self, urls: list[str]) -> list[UrlAnalysisResult]:
        return [self.scan_url(url) for url in urls]
