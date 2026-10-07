"""Generate an RSA key pair for signing model manifests.

Keep the private key in Secret Manager. Only the base64 DER public key belongs
in the mobile build configuration.
"""

import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa


key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
private = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
)
public = key.public_key().public_bytes(
    serialization.Encoding.DER,
    serialization.PublicFormat.SubjectPublicKeyInfo,
)
print("MODEL_PATCH_SIGNING_KEY_PEM_B64=" + base64.b64encode(private).decode())
print("MODEL_MANIFEST_PUBLIC_KEY_DER_B64=" + base64.b64encode(public).decode())
