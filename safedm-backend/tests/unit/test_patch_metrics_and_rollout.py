"""Manifest metrics nesting + canary rollout contract for mobile/dashboard."""

import json
from unittest.mock import MagicMock

from app.api.v1.models import latest_model_manifest
from app.core.config import get_settings
from app.models import User
from app.models.admin_operations import PatchDeployment
from app.services.admin_service import extract_patch_metrics


NESTED_MANIFEST = {
    "version": "ml-1-abc123",
    "artifact_sha256": "a" * 64,
    "patch": {
        "model_version": 1,
        "status": "research",
        "canary_percent": 5,
        "quantization": {"weights": [1], "threshold_score": 1, "intercept": 0},
        "training": {
            "validated": {
                "recall": 0.8,
                "false_positive_rate": 0.2,
                "at_operational_threshold": {
                    "recall": 0.706,
                    "false_positive_rate": 0.364,
                },
            }
        },
    },
    "rollout": {"stage": "canary", "percentage": 0},
}


def test_extract_patch_metrics_prefers_operational_threshold():
    metrics = extract_patch_metrics(NESTED_MANIFEST)
    assert metrics["recall"] == 0.706
    assert metrics["false_positive_rate"] == 0.364


def test_extract_patch_metrics_legacy_top_level():
    metrics = extract_patch_metrics(
        {"metrics": {"recall": 0.9, "false_positive_rate": 0.05}}
    )
    assert metrics["recall"] == 0.9


def test_latest_manifest_staged_deployment_is_zero_percent(tmp_path, monkeypatch):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps(NESTED_MANIFEST), encoding="utf-8")
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(path))

    db = MagicMock()
    db.scalar.return_value = PatchDeployment(
        version="ml-1-abc123",
        status="CANARY",
        rollout_percentage=0,
    )
    body = json.loads(latest_model_manifest(User(id=1), db).body)
    assert body["rollout"] == {"percentage": 0, "stage": "canary"}


def test_latest_manifest_approved_canary(tmp_path, monkeypatch):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps(NESTED_MANIFEST), encoding="utf-8")
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(path))

    db = MagicMock()
    db.scalar.return_value = PatchDeployment(
        version="ml-1-abc123",
        status="APPROVED",
        rollout_percentage=5,
    )
    body = json.loads(latest_model_manifest(User(id=1), db).body)
    assert body["rollout"] == {"percentage": 5.0, "stage": "canary"}


def test_latest_manifest_no_deployment_honours_file_rollout(tmp_path, monkeypatch):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps(NESTED_MANIFEST), encoding="utf-8")
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(path))

    db = MagicMock()
    db.scalar.return_value = None
    body = json.loads(latest_model_manifest(User(id=1), db).body)
    assert body["rollout"]["stage"] == "canary"
    assert body["rollout"]["percentage"] == 0.0


def test_try_message_scores_manifest_patch(tmp_path, monkeypatch):
    from app.services.ml_ops_service import MlOpsService
    from app.utils.feature_extraction import FEATURE_COUNT

    artifact = {
        "model_version": 1,
        "quantization": {
            "weights": [0] * FEATURE_COUNT,
            "weight_scale": 10_000,
            "threshold_score": 10**9,
            "intercept": 0,
        },
    }
    path = tmp_path / "latest.json"
    path.write_text(
        json.dumps(
            {
                "version": "ml-test",
                "patch": artifact,
                "rollout": {"stage": "canary", "percentage": 0},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(path))

    result = MlOpsService(MagicMock()).try_message("Bonjour, votre colis arrive demain.")
    assert result["malicious"] is False
    assert result["decision"] == "benign"
    assert result["feature_count"] == FEATURE_COUNT
    assert "patch JSON" in result["note"]
