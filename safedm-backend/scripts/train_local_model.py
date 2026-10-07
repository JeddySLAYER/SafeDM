#!/usr/bin/env python3
"""CLI wrapper — train signed integer logistic patch via ``ml.models.training``.

Official mobile-facing artefact is the signed JSON logistic model (deterministic
integer scores). TFLite remains an optional float32 export for the current Expo
runtime (``scripts/export_tflite_model.py``).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure repo root is importable when launched as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.models.training import train_and_export  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Entraine et signe le modele local SafeDM")
    parser.add_argument("--out", required=True, help="chemin du patch JSON signe")
    parser.add_argument(
        "--private-key",
        help="cle ECDSA P-256 PEM. Generee aleatoirement si absente (mode dev).",
    )
    parser.add_argument(
        "--no-register",
        action="store_true",
        help="Ne pas ecrire dans models/metadata/model_registry.json",
    )
    args = parser.parse_args()
    train_and_export(
        Path(args.out),
        private_key_path=Path(args.private_key) if args.private_key else None,
        register=not args.no_register,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
