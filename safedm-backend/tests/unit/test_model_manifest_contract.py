"""Contrat du manifeste OTA entre le backend et le telephone.

Le mobile (`safedm-mobile/src/services/modelUpdate.js`) verifie le manifeste
avec des regles precises :

* `manifest.public_key_hex` doit etre **egal** a la cle epinglee dans l'app ;
* la signature est un ECDSA P-256 **DER** encode en hex ;
* le payload signe est le patch **sans** sa cle `signature`, serialise en
  JSON canonique (cles triees, separateurs compacts, unicode brut).

Ces tests rejouent ces regles cot�� backend : c'est la seule facon de
detecter une derive de format avant qu'un million de telephones n'ignorent
silencieusement la mise a jour.
"""

import json
from unittest.mock import MagicMock

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from app.api.v1.models import latest_model_manifest
from app.core.config import get_settings
from app.models import User
from ml.models.manifest import sha256_file, write_manifest
from ml.models.training import build_patch


def _canonical(value) -> str:
    """Reimplementation de `canonical()` du cote JavaScript."""

    if isinstance(value, list):
        return "[" + ",".join(_canonical(item) for item in value) + "]"

    if isinstance(value, dict):
        body = ",".join(
            f"{json.dumps(key)}:{_canonical(value[key])}" for key in sorted(value)
        )
        return "{" + body + "}"

    return json.dumps(value, ensure_ascii=False)


def _der_to_raw(der: bytes) -> bytes:
    """Reimplementation de `derEcdsaToRaw()` du cote JavaScript."""

    if len(der) < 8 or der[0] != 0x30 or der[2] != 0x02:
        raise ValueError("pas une signature DER ECDSA")

    offset = 3
    r_length = der[offset]
    offset += 1
    r = der[offset : offset + r_length]
    offset += r_length

    if der[offset] != 0x02:
        raise ValueError("s absent")
    offset += 1
    s_length = der[offset]
    offset += 1
    s = der[offset : offset + s_length]

    # DER encode les entiers positifs avec un octet de tete si le bit haut
    # est positionne : le mobile le retire avant de reconstruire le format
    # "raw" de 64 octets attendu par WebCrypto.
    if len(r) > 32 and r[0] == 0:
        r = r[1:]
    if len(s) > 32 and s[0] == 0:
        s = s[1:]
    if len(r) > 32 or len(s) > 32 or offset + s_length != len(der):
        raise ValueError("signature mal formee")

    raw = bytearray(64)
    raw[32 - len(r) : 32] = r
    raw[64 - len(s) : 64] = s
    return bytes(raw)


def _mobile_verify(manifest: dict, pinned_key_hex: str) -> bool:
    """Verifie le manifeste exactement comme le telephone le fait."""

    patch = manifest.get("patch")
    if not patch or not patch.get("signature"):
        return False
    if str(manifest.get("public_key_hex") or "").lower() != pinned_key_hex.lower():
        return False

    # Le mobile convertit le DER en format "raw" (r||s sur 64 octets) car
    # WebCrypto l'exige. On repasse donc le raw en DER pour verifier avec
    # `cryptography`, qui attend du DER.
    raw = _der_to_raw(bytes.fromhex(patch["signature"]))
    der = encode_dss_signature(
        int.from_bytes(raw[:32], "big"),
        int.from_bytes(raw[32:], "big"),
    )

    unsigned = {key: value for key, value in patch.items() if key != "signature"}

    public_key = ec.EllipticCurvePublicKey.from_encoded_point(
        ec.SECP256R1(), bytes.fromhex(pinned_key_hex)
    )
    try:
        public_key.verify(
            der,
            _canonical(unsigned).encode("utf-8"),
            ec.ECDSA(hashes.SHA256()),
        )
    except Exception:
        return False
    return True


@pytest.fixture()
def signing_key():
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture()
def pinned_key_hex(signing_key) -> str:
    return signing_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    ).hex()


def test_model_manifest_is_not_cached_and_requires_valid_version(tmp_path, monkeypatch):
    manifest_path = tmp_path / "latest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "version": "model-test",
                # La cle publique est obligatoire : le mobile compare
                # manifest.public_key_hex a la cle epinglee dans l'app et
                # refuse silencieusement un manifeste sans elle.
                "public_key_hex": "04" + "ab" * 64,
                "patch": {
                    "quantization": {
                        "weights": {"safe": [1], "suspicious": [2]},
                        "scales": [1.0],
                        "zero_points": [0],
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(manifest_path))

    db = MagicMock()
    db.scalar.return_value = None
    response = latest_model_manifest(User(id=1), db)

    assert response.headers["cache-control"] == "no-store"
    assert json.loads(response.body)["version"] == "model-test"


def test_published_manifest_is_accepted_by_the_mobile_verifier(
    tmp_path, signing_key, pinned_key_hex
):
    """Le manifeste publie doit passer la verification du telephone."""

    patch = build_patch(
        {"weights": [1, 2], "threshold_score": 5, "intercept": 0},
        {"recall": 0.8, "false_positive_rate": 0.1},
        42,
        signing_key,
        publishable=True,
        dataset_ref="tests/fixtures/jev_benchmark_baseline.json",
    )
    patch_path = tmp_path / "patch.json"
    patch_path.write_text(json.dumps(patch), encoding="utf-8")

    target = tmp_path / "latest.json"
    write_manifest(
        patch,
        artifact_sha256=sha256_file(patch_path),
        public_key_hex=pinned_key_hex,
        target=target,
    )
    manifest = json.loads(target.read_text(encoding="utf-8"))

    assert _mobile_verify(manifest, pinned_key_hex) is True


def test_manifest_is_rejected_when_the_pinned_key_differs(
    tmp_path, signing_key, pinned_key_hex
):
    """Un manifeste signe par une autre cle doit etre rejete (anti-substitution)."""

    patch = build_patch(
        {"weights": [1, 2], "threshold_score": 5, "intercept": 0},
        {"recall": 0.8, "false_positive_rate": 0.1},
        42,
        signing_key,
        publishable=True,
        dataset_ref="tests/fixtures/jev_benchmark_baseline.json",
    )
    patch_path = tmp_path / "patch.json"
    patch_path.write_text(json.dumps(patch), encoding="utf-8")

    target = tmp_path / "latest.json"
    other_key_hex = (
        ec.generate_private_key(ec.SECP256R1())
        .public_key()
        .public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        .hex()
    )
    write_manifest(
        patch,
        artifact_sha256=sha256_file(patch_path),
        public_key_hex=other_key_hex,
        target=target,
    )
    manifest = json.loads(target.read_text(encoding="utf-8"))

    assert _mobile_verify(manifest, pinned_key_hex) is False


def test_published_manifest_is_served_by_the_endpoint(
    tmp_path, signing_key, pinned_key_hex, monkeypatch
):
    """Le format publie doit traverser /models/latest sans alteration."""

    patch = build_patch(
        {"weights": [1, 2], "threshold_score": 5, "intercept": 0},
        {"recall": 0.8, "false_positive_rate": 0.1},
        42,
        signing_key,
        publishable=True,
        dataset_ref="tests/fixtures/jev_benchmark_baseline.json",
    )
    patch_path = tmp_path / "patch.json"
    patch_path.write_text(json.dumps(patch), encoding="utf-8")

    target = tmp_path / "latest.json"
    write_manifest(
        patch,
        artifact_sha256=sha256_file(patch_path),
        public_key_hex=pinned_key_hex,
        target=target,
    )
    monkeypatch.setattr(get_settings(), "model_patch_manifest_path", str(target))

    db = MagicMock()
    db.scalar.return_value = None
    body = json.loads(latest_model_manifest(User(id=1), db).body)

    assert _mobile_verify(body, pinned_key_hex) is True
    assert body["public_key_hex"] == pinned_key_hex.lower()
