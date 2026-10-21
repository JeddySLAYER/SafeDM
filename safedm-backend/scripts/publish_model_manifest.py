#!/usr/bin/env python3
"""Publie un patch signe comme manifeste OTA (format attendu par le mobile).

Le workflow d'entrainement produit un patch JSON signe brut. Le telephone
attend un *wrapper* : version, empreinte, cle publique et rollout. Ce script
effectue l'assemblage, avec le meme code que la promotion faite depuis
l'API admin (``app/services/ml_ops_service.py``).

Exemple :
    python scripts/publish_model_manifest.py \\
        --patch outputs/train/patch_123.json \\
        --public-key-hex 04ab... \\
        --out artifacts/weekly/latest.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Ensure repo root is importable when launched as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.models.manifest import sha256_file, write_manifest  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Publie un patch signe comme manifeste OTA"
    )
    parser.add_argument("--patch", required=True, help="chemin du patch JSON signe")
    parser.add_argument(
        "--public-key-hex",
        required=True,
        help="point public ECDSA P-256 non compresse, hex (cle embarquee dans l'app)",
    )
    parser.add_argument(
        "--out",
        default="artifacts/weekly/latest.json",
        help="chemin du manifeste a ecrire",
    )
    parser.add_argument(
        "--rollout-percentage",
        type=int,
        default=0,
        help="pourcentage de rollout initial (0 = canary en attente d'approbation)",
    )
    args = parser.parse_args()

    patch_path = Path(args.patch)
    if not patch_path.exists():
        print(f"::error::patch introuvable : {patch_path}")
        return 1

    try:
        patch = json.loads(patch_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"::error::patch illisible : {exc}")
        return 1

    try:
        manifest = write_manifest(
            patch,
            artifact_sha256=sha256_file(patch_path),
            public_key_hex=args.public_key_hex,
            target=Path(args.out),
            rollout={"stage": "canary", "percentage": args.rollout_percentage},
        )
    except ValueError as exc:
        print(f"::error::manifeste refuse : {exc}")
        return 1

    print(f"manifeste ecrit : {args.out}")
    print(f"version : {manifest['version']}")
    print(f"sha256 : {manifest['artifact_sha256']}")
    print(f"rollout : {manifest['rollout']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
