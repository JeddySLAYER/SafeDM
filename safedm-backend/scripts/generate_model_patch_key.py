#!/usr/bin/env python3
"""Genere la paire de cles ECDSA P-256 qui signe les patchs OTA du modele.

Deux usages distincts, a ne pas confondre :

* ``MODEL_PATCH_SIGNING_KEY_PEM_B64`` (RSA)  : signe le manifeste *politique*
  hebdomadaire, verifie par le mobile via ``MODEL_MANIFEST_PUBLIC_KEY``.
* ``ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64`` (EC) : signe le patch JSON *modele*
  OTA, verifie par le mobile via ``MODEL_PATCH_PUBLIC_KEY_HEX``.

Ce script couvre la seconde chaine (EC P-256).

La cle privee est un secret : la conserver dans le gestionnaire de secrets
(backend ``.env`` + secret GitHub ``ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64``).
La cle publique, elle, est embarquee dans l'application : elle n'est pas
secrete et peut etre versionnee.

    python scripts/generate_model_patch_key.py
"""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def main() -> int:
    key = ec.generate_private_key(ec.SECP256R1())
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_point = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )

    private_b64 = base64.b64encode(private_pem).decode()
    public_hex = public_point.hex()

    assert len(public_hex) == 130, "point public non compresse attendu (130 hex)"

    print("ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64=" + private_b64)
    print("MODEL_PATCH_PUBLIC_KEY_HEX=" + public_hex)
    print()
    print("A poser :")
    print("  - backend .env           -> ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64")
    print("  - secret GitHub Actions  -> ML_PATCH_SIGNING_PRIVATE_KEY_PEM_B64")
    print("  - build mobile (eas.json / app.config.js) -> MODEL_PATCH_PUBLIC_KEY_HEX")
    print()
    print("La cle publique DOIT etre identique dans l'app et dans le manifeste :")
    print("c'est elle que le mobile compare au point public de la signature.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
