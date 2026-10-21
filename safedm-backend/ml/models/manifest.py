"""Construction du manifeste de patch modèle (format unique, partagé OTA).

Le téléphone (cf. ``safedm-mobile/src/services/modelUpdate.js``) attend un
manifeste *wrapper* :

```json
{
  "version": "ml-1-<digest12>",
  "artifact_sha256": "<sha256 du patch>",
  "public_key_hex": "<point public ECDSA P-256 non compresse, hex>",
  "patch": { ... patch signe ... },
  "rollout": { "stage": "canary", "percentage": 0 }
}
```

Le patch brut (sans wrapper) n'est pas verifiable par le mobile : il ne
contient ni `public_key_hex` ni `rollout`. Ce module est donc la seule source
de verite du format, utilisee par la promotion via l'API admin ET par le
script CI qui publie le manifeste hebdomadaire.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

DEFAULT_ROLLOUT = {"stage": "canary", "percentage": 0}


def build_manifest(
    patch: dict[str, Any],
    *,
    artifact_sha256: str,
    public_key_hex: str,
    rollout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble le manifeste wrapper a partir d'un patch signe."""
    if not isinstance(patch, dict):
        raise ValueError("le patch doit etre un objet JSON")
    quantization = patch.get("quantization")
    if not isinstance(quantization, dict) or not quantization.get("weights"):
        raise ValueError("le patch ne contient pas de quantification exploitable")
    if not public_key_hex:
        raise ValueError(
            "cle publique absente : le mobile ne pourrait pas verifier la signature"
        )

    version = f"ml-{patch.get('model_version', 1)}-{artifact_sha256[:12]}"
    return {
        "version": version,
        "artifact_sha256": artifact_sha256,
        "public_key_hex": public_key_hex.strip().lower(),
        "patch": patch,
        "rollout": dict(rollout or DEFAULT_ROLLOUT),
    }


def write_manifest(
    patch: dict[str, Any],
    *,
    artifact_sha256: str,
    public_key_hex: str,
    target: Path,
    rollout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Ecrit le manifeste sur disque et retourne son contenu."""
    manifest = build_manifest(
        patch,
        artifact_sha256=artifact_sha256,
        public_key_hex=public_key_hex,
        rollout=rollout,
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return manifest


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
