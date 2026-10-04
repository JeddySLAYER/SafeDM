#!/usr/bin/env python3
"""Genere les jeux de patches de test (cle de dev) pour le harnais Kotlin.

Produit :
  /tmp/patches/dev_key.pem        cle privee ECDSA P-256 (DEV, jamais en prod)
  /tmp/patches/pubkey.hex         cle publique X9.62 non compressee
  /tmp/patches/model_v1.json      patch signe, statut 'research' (non deployable)
  /tmp/patches/test_production.json  patch signe, statut 'production'
  /tmp/patches/tampered_status.json  statut modifie APRES signature

Le dernier est le test le plus important : il verifie que la signature couvre
bien le champ `status`, donc qu'on ne peut pas promouvoir un patch rejete en
modele actif en editant un seul octet du JSON.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.feature_extraction import extract_features, vector_hash  # noqa: E402


def canonical(payload: dict) -> str:
    return json.dumps(
        {k: v for k, v in payload.items() if k != "signature"},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def main() -> int:
    out_dir = Path("/tmp/patches")
    out_dir.mkdir(parents=True, exist_ok=True)

    key = ec.generate_private_key(ec.SECP256R1())
    (out_dir / "dev_key.pem").write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    public_key = key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    (out_dir / "pubkey.hex").write_text(public_key.hex() + "\n")

    def sign(payload: dict) -> dict:
        stripped = {k: v for k, v in payload.items() if k != "signature"}
        signature = key.sign(canonical(stripped).encode(), ec.ECDSA(hashes.SHA256()))
        return {**stripped, "signature": signature.hex()}

    base = json.loads((out_dir / "model_v1.json").read_text(encoding="utf-8"))

    (out_dir / "model_v1.json").write_text(json.dumps(sign(base), indent=2), encoding="utf-8")
    (out_dir / "test_production.json").write_text(
        json.dumps(sign({**base, "status": "production"}), indent=2), encoding="utf-8"
    )

    # On CHANGE le statut en GARDANT la signature d'origine. Retirer la
    # signature ne testerait rien : le chargement echouerait de toute facon sur
    # « signature absente ». Ce qu'on veut prouver ici, c'est precisement que
    # `status` est couvert par la signature — donc qu'on ne peut pas promouvoir
    # un patch rejete en modele actif en editant un seul champ.
    tampered = dict(base)
    tampered["status"] = "production"
    assert tampered["signature"] == base["signature"]
    (out_dir / "tampered_status.json").write_text(
        json.dumps(tampered, indent=2), encoding="utf-8"
    )

    # Fixture de parite modele : hash et score entiers attendus par Kotlin.
    golden = json.loads(
        (Path(__file__).resolve().parents[1] / "tests/fixtures/feature_vectors.json").read_text(
            encoding="utf-8"
        )
    )
    quantization = base["quantization"]
    rows = []
    for case in golden["cases"]:
        text = (
            case["text_repeat"]["unit"] * case["text_repeat"]["count"]
            if "text_repeat" in case
            else case["text"]
        )
        features = [int(v) for v in extract_features(text, known_bad_url=case["known_bad_url"])]
        score = quantization["intercept"] + sum(
            w * v for w, v in zip(quantization["weights"], features, strict=True)
        )
        rows.append(
            {
                "name": case["name"],
                "features": features,
                "hash": vector_hash(features),
                "score": score,
                "malicious": score >= quantization["threshold_score"],
            }
        )
    Path("/tmp/model_parity.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"patches de test ecrits dans {out_dir} ({len(rows)} cas de parite modele)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())