import json
from unittest.mock import MagicMock

from app.api.v1.models import latest_model_manifest
from app.core.config import get_settings
from app.models import User


def test_model_manifest_is_not_cached_and_requires_valid_version(tmp_path, monkeypatch):
    manifest_path = tmp_path / "latest.json"
    manifest_path.write_text(json.dumps({"version": "policy-test"}), encoding="utf-8")
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(manifest_path))

    db = MagicMock()
    db.scalar.return_value = None
    response = latest_model_manifest(User(id=1), db)

    assert response.headers["cache-control"] == "no-store"
    assert json.loads(response.body)["version"] == "policy-test"
