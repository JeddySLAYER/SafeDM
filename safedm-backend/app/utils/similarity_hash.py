"""Similarity-preserving fingerprints shared by the Sprint 3 report flow."""

from __future__ import annotations

import hashlib
import re

_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_SPACE_RE = re.compile(r"\s+")


def normalize_for_similarity(content: str) -> str:
    return _SPACE_RE.sub(
        " ",
        _URL_RE.sub(" <url> ", content.lower()),
    ).strip()


def compute_similarity_hash(content: str) -> str:
    tokens = normalize_for_similarity(content).split()
    if not tokens:
        return "0000000000000000"
    shingles = (
        [" ".join(tokens)]
        if len(tokens) < 3
        else [" ".join(tokens[i : i + 3]) for i in range(len(tokens) - 2)]
    )
    votes = [0] * 64
    for shingle in shingles:
        digest = hashlib.sha256(shingle.encode("utf-8")).digest()
        for bit in range(64):
            votes[bit] += 1 if digest[bit // 8] & (1 << (bit % 8)) else -1
    value = sum(1 << bit for bit, vote in enumerate(votes) if vote >= 0)
    return f"{value:016x}"
