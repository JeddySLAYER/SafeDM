import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.services.weekly_patch_service import build_weekly_patch


def test_weekly_patch_is_versioned_and_deterministic(tmp_path):
    end = datetime(2026, 10, 4, tzinfo=timezone.utc)
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    manifest = build_weekly_patch(db, period_end=end, output_dir=tmp_path)

    assert manifest["version"] == "policy-20261004T000000Z"
    assert manifest["deployment"] == {"applied": False, "status": "POLICY_ONLY"}
    assert "rollout" not in manifest
    assert "model_url" not in manifest
    assert "artifact_sha256" not in manifest
    assert manifest["metrics"]["status"] == "unlabeled_data"
    assert (tmp_path / "latest.json").exists()
    loaded = json.loads((tmp_path / "latest.json").read_text())
    assert loaded["manifest_sha256"] == manifest["manifest_sha256"]


def test_weekly_aggregation_rejects_model_manifest_directory(tmp_path, monkeypatch):
    from app.services import weekly_patch_service

    settings = MagicMock(
        threshold_safe_score=0.3,
        threshold_suspicious_score=0.6,
        threshold_critical_score=0.9,
        threshold_escalation_confidence=0.8,
        model_patch_signing_key_pem_b64=None,
        weekly_aggregation_manifest_path=str(tmp_path / "aggregation" / "latest.json"),
        model_patch_manifest_path=str(tmp_path / "latest.json"),
    )
    monkeypatch.setattr(weekly_patch_service, "get_settings", lambda: settings)
    db = MagicMock()
    db.scalars.return_value.all.return_value = []

    with pytest.raises(ValueError, match="must not share the model manifest directory"):
        build_weekly_patch(db, output_dir=tmp_path)
