"""Verify Firebase ID tokens (RS256) and map them to SafeDM users.

No service-account JSON is required to *verify* tokens: Google publishes
the securetoken certificates. Issuing tokens still happens in the Firebase
client (mobile / dashboard) with the web config.
"""

from __future__ import annotations

import re
import time
from typing import Any

import httpx
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.x509 import load_pem_x509_certificate
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings

_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)
_certs_cache: dict[str, Any] = {"at": 0.0, "certs": {}}


def firebase_enabled() -> bool:
    return bool(get_settings().firebase_project_id.strip())


def _certificates() -> dict[str, str]:
    now = time.time()
    if _certs_cache["certs"] and now - _certs_cache["at"] < 3600:
        return _certs_cache["certs"]
    response = httpx.get(_CERTS_URL, timeout=10)
    response.raise_for_status()
    certs = response.json()
    if not isinstance(certs, dict):
        raise HTTPException(status_code=502, detail="Certificats Firebase illisibles")
    _certs_cache["certs"] = certs
    _certs_cache["at"] = now
    return certs


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    project_id = get_settings().firebase_project_id.strip()
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FIREBASE_PROJECT_ID n'est pas configuré",
        )
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Jeton Firebase invalide") from exc
    kid = header.get("kid")
    cert_pem = _certificates().get(kid or "")
    if not cert_pem:
        raise HTTPException(status_code=401, detail="Clé Firebase inconnue")
    cert = load_pem_x509_certificate(cert_pem.encode())
    public_pem = cert.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    try:
        claims = jwt.decode(
            id_token,
            public_pem,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Jeton Firebase refusé") from exc
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Jeton Firebase sans sujet")
    return claims


def username_from_identity(email: str | None, uid: str) -> str:
    raw = (email or "").split("@", 1)[0] or f"fb{uid[:10]}"
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", raw).strip("_")[:48]
    if len(cleaned) < 3:
        cleaned = f"fb_{uid[:12]}"
    return cleaned[:64]


def is_firebase_admin(email: str | None, claims: dict[str, Any]) -> bool:
    if claims.get("admin") is True:
        return True
    if not email:
        return False
    allowed = {
        item.strip().lower()
        for item in get_settings().firebase_admin_emails.split(",")
        if item.strip()
    }
    return email.lower() in allowed
