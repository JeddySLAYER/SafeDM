"""Smoke tests for the offline ``ml`` package layout."""

from pathlib import Path

from ml.data.loaders import default_benchmark_path, load_labeled_messages, repo_root
from ml.evaluation.evaluate_cli import feature_parity_smoke
from ml.features import FEATURE_COUNT
from ml.models.registry import registry_path


def test_repo_root_points_at_backend():
    root = repo_root()
    assert (root / "app" / "main.py").exists()
    assert (root / "ml" / "__init__.py").exists()


def test_load_labeled_messages_shape():
    X, y, texts = load_labeled_messages()
    assert X.shape[1] == FEATURE_COUNT
    assert len(y) == len(texts) == X.shape[0]
    assert X.shape[0] >= 10


def test_benchmark_prefers_processed_when_present():
    path = default_benchmark_path()
    assert path.exists()
    assert "labeled_messages.json" in str(path) or "jev_benchmark" in path.name


def test_feature_parity_smoke():
    result = feature_parity_smoke()
    assert result["ok"] == result["checked"]
    assert result["feature_count"] == FEATURE_COUNT


def test_registry_path():
    path = registry_path()
    assert path.name == "model_registry.json"
    assert path.parent.name == "metadata"
