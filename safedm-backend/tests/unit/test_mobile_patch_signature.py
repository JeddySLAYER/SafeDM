import json

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

from ml.models.training import build_patch


def test_patch_signature_uses_javascript_compatible_integer_float_encoding():
    private_key = ec.generate_private_key(ec.SECP256R1())
    patch = build_patch(
        {"weights": [0] * 50, "weight_scale": 10_000, "threshold_score": 5_000, "intercept": 0},
        {"at_operational_threshold": {"false_positive_rate": 0.0, "recall": 1.0}},
        3,
        private_key,
        False,
        dataset_ref="test",
    )
    signature = bytes.fromhex(patch.pop("signature"))
    def normalize_numbers(value):
        if isinstance(value, dict):
            return {key: normalize_numbers(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normalize_numbers(item) for item in value]
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    canonical = json.dumps(
        normalize_numbers(patch), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )

    assert '"false_positive_rate":0' in canonical
    assert '"recall":1}' in canonical
    private_key.public_key().verify(signature, canonical.encode(), ec.ECDSA(hashes.SHA256()))
