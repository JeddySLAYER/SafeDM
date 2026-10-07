import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.services.weekly_patch_service import build_weekly_patch


def test_weekly_patch_is_versioned_and_deterministic(tmp_path):
    end = datetime(2026, 10, 4, tzinfo=timezone.utc)
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    manifest = build_weekly_patch(db, period_end=end, output_dir=tmp_path)

    assert manifest["version"] == "policy-20261004T000000Z"
    assert manifest["rollout"] == {"stage": "canary", "percentage": 1}
    assert manifest["metrics"]["status"] == "unlabeled_data"
    assert (tmp_path / "latest.json").exists()
    loaded = json.loads((tmp_path / "latest.json").read_text())
    assert loaded["manifest_sha256"] == manifest["manifest_sha256"]
