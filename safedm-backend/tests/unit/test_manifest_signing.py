import base64
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.core.config import get_settings
from app.services.weekly_patch_service import build_weekly_patch


def test_weekly_manifest_signature_covers_manifest(tmp_path, monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    monkeypatch.setattr(
        get_settings(),
        "model_patch_signing_key_pem_b64",
        base64.b64encode(private).decode(),
    )
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    manifest = build_weekly_patch(
        db,
        period_end=datetime(2026, 10, 4, tzinfo=timezone.utc),
        output_dir=tmp_path,
    )
    signature = base64.b64decode(manifest.pop("signature"))
    canonical = json.dumps(
        manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    key.public_key().verify(
        signature,
        canonical,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
