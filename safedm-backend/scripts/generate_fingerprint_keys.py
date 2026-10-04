#!/usr/bin/env python3
"""Generate the Sprint 3 RSA-OAEP key pair without writing secrets to Git."""

import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
private_pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
)
public_der = key.public_key().public_bytes(
    serialization.Encoding.DER,
    serialization.PublicFormat.SubjectPublicKeyInfo,
)
print("FINGERPRINT_PRIVATE_KEY_PEM_B64=" + base64.b64encode(private_pem).decode())
print("FINGERPRINT_PUBLIC_KEY=" + base64.b64encode(public_der).decode())
