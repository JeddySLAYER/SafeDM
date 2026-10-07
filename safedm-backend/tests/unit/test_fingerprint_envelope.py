import base64
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.services.fingerprint_envelope import decrypt_fingerprint_envelope


def test_fingerprint_envelope_decrypts_without_content():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    aes_key = AESGCM.generate_key(bit_length=256)
    nonce = b"123456789012"
    plaintext = json.dumps({"similarity_hash": "0123456789abcdef"}).encode()
    ciphertext = AESGCM(aes_key).encrypt(
        nonce, plaintext, b"SafeDM-Fingerprint-v1"
    )
    encrypted_key = key.public_key().encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    result = decrypt_fingerprint_envelope(
        {
            "encrypted_key": base64.b64encode(encrypted_key).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "ciphertext": base64.b64encode(ciphertext).decode(),
        },
        private_pem,
    )
    assert result["similarity_hash"] == "0123456789abcdef"
