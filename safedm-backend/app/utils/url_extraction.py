"""URL extraction from message text."""

from __future__ import annotations

import re
from urllib.parse import urlparse

_URL_RE = re.compile(
    r"(?i)\b("
    r"(?:https?://|www\.)"
    r"[^\s<>\"']+"
    r")"
)


def extract_urls(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for match in _URL_RE.findall(text or ""):
        url = match.rstrip(").,;]!?>\"'")
        if url.lower().startswith("www."):
            url = f"https://{url}"
        if url not in seen:
            seen.add(url)
            found.append(url)
    return found


def extract_domain(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        host = parsed.netloc or parsed.path.split("/")[0]
        return host.lower() or None
    except Exception:
        return None
