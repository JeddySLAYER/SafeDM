"""Hashing helpers for threat fingerprinting — never log raw content."""

from __future__ import annotations

import hashlib
import re
import unicodedata


_WHITESPACE_RE = re.compile(r"\s+")
_URL_IN_TEXT_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)


def compute_raw_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def normalize_content(content: str) -> str:
    """Prudent normalization for near-duplicate detection."""
    text = unicodedata.normalize("NFKC", content)
    text = text.lower().strip()
    text = _URL_IN_TEXT_RE.sub(" <url> ", text)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()


def compute_normalized_hash(content: str) -> str:
    return hashlib.sha256(normalize_content(content).encode("utf-8")).hexdigest()


def compute_url_hash(url: str) -> str:
    return hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
