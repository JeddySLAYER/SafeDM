import base64
import binascii
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag


class FingerprintEnvelopeError(ValueError):
    pass


def decrypt_fingerprint_envelope(
    envelope: dict[str, str],
    private_key_pem: str,
) -> dict:
    try:
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"),
            password=None,
        )
        key = private_key.decrypt(
            base64.b64decode(envelope["encrypted_key"], validate=True),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        nonce = base64.b64decode(envelope["nonce"], validate=True)
        ciphertext = base64.b64decode(envelope["ciphertext"], validate=True)
        if len(key) != 32 or len(nonce) != 12:
            raise ValueError("invalid envelope sizes")
        plaintext = AESGCM(key).decrypt(nonce, ciphertext, b"SafeDM-Fingerprint-v1")
        payload = json.loads(plaintext)
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        return payload
    except (
        KeyError,
        ValueError,
        TypeError,
        binascii.Error,
        json.JSONDecodeError,
        InvalidTag,
    ) as exc:
        raise FingerprintEnvelopeError("invalid fingerprint envelope") from exc
