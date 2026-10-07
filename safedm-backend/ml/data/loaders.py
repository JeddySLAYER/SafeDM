"""Dataset loaders for offline training."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.utils.feature_extraction import extract_features

BENIGN_LABELS = {"legitimate", "benign_marketing"}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_benchmark_path() -> Path:
    """Prefer a frozen processed dataset when present, else test fixtures."""
    root = repo_root()
    processed = root / "data" / "processed" / "labeled_messages.json"
    if processed.exists():
        return processed
    return root / "tests" / "fixtures" / "jev_benchmark_baseline.json"


def default_golden_path() -> Path:
    return repo_root() / "tests" / "fixtures" / "feature_vectors.json"


def load_labeled_messages(
    benchmark_path: Path | None = None,
    *,
    known_bad_url: int = 128,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Build feature matrix and binary labels from the Jev benchmark fixture.

    ``known_bad_url`` defaults to 128 (unverified) — the on-device value when
    no network reputation is available.
    """
    path = benchmark_path or default_benchmark_path()
    cases = json.loads(path.read_text(encoding="utf-8"))
    rows: list[list[int]] = []
    labels: list[int] = []
    texts: list[str] = []
    for case in cases:
        text = case["message"]
        rows.append([int(v) for v in extract_features(text, known_bad_url=known_bad_url)])
        labels.append(0 if case["expected"] in BENIGN_LABELS else 1)
        texts.append(text)
    return np.asarray(rows, dtype=np.float64), np.asarray(labels), texts
