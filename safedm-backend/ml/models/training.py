"""Train integer logistic patch (official artefact) and optional registry entry."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sklearn.linear_model import LogisticRegression

from ml.data.loaders import (
    default_benchmark_path,
    default_golden_path,
    load_labeled_messages,
    repo_root,
)
from ml.evaluation.metrics import (
    cross_val_metrics,
    decide_threshold,
    out_of_fold_probabilities,
)
from ml.features import FEATURE_NAMES
from ml.models.registry import register_artifact

MODEL_VERSION = 1


def golden_fixture_sha256(golden_path: Path | None = None) -> str:
    path = golden_path or default_golden_path()
    return hashlib.sha256(path.read_bytes()).hexdigest()


def quantize(model: LogisticRegression, threshold: float) -> dict:
    scale = 10_000
    weights = [int(round(w * scale)) for w in model.coef_[0]]
    return {
        "weights": weights,
        "weight_scale": scale,
        "threshold_score": int(round(threshold * scale)),
        "intercept": 0,
    }


def score_from_quantized(quantized: dict, features: list[int]) -> int:
    total = quantized["intercept"]
    for weight, value in zip(quantized["weights"], features, strict=True):
        total += weight * int(value)
    return total


def build_patch(
    quantized: dict,
    metrics: dict,
    dataset_size: int,
    private_key: ec.EllipticCurvePrivateKey,
    publishable: bool,
    *,
    dataset_ref: str,
) -> dict:
    payload = {
        "model_version": MODEL_VERSION,
        "status": "production" if publishable else "research",
        "feature_names": list(FEATURE_NAMES),
        "golden_fixture_sha256": golden_fixture_sha256(),
        "quantization": quantized,
        "training": {
            "dataset": dataset_ref,
            "samples": dataset_size,
            "validated": metrics,
            "trained_at": datetime.now(UTC).isoformat(),
        },
        "canary_percent": 5,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    signature = private_key.sign(canonical.encode(), ec.ECDSA(hashes.SHA256()))
    payload["signature"] = signature.hex()
    return payload


def train_and_export(
    out: Path,
    *,
    private_key_path: Path | None = None,
    register: bool = True,
    dataset_path: Path | None = None,
) -> dict[str, Any]:
    """Fit, evaluate, write signed JSON patch, optionally update the registry."""
    benchmark = Path(dataset_path) if dataset_path else default_benchmark_path()
    X, y, texts = load_labeled_messages(benchmark)
    print(f"dataset : {X.shape[0]} messages, {X.shape[1]} features")
    print(f"  benins : {int((y == 0).sum())}   malveillants : {int((y == 1).sum())}")

    model = LogisticRegression(
        C=0.5,
        max_iter=2000,
        class_weight="balanced",
        solver="liblinear",
    )
    model.fit(X, y)

    metrics = cross_val_metrics(model, X, y)
    print("\nvalidation croisee (et NON la precision d'entrainement) :")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

    oof, _n_splits = out_of_fold_probabilities(model, X, y)
    threshold = decide_threshold(oof, y)
    if threshold is None:
        threshold = 0.95
        threshold_feasible = False
    else:
        threshold_feasible = True

    final = (oof >= threshold).astype(int)
    tp = int(((final == 1) & (y == 1)).sum())
    fp = int(((final == 1) & (y == 0)).sum())
    fn = int(((final == 0) & (y == 1)).sum())
    tn = int(((final == 0) & (y == 0)).sum())
    deployed_metrics = {
        "precision": round(tp / max(1, tp + fp), 3),
        "recall": round(tp / max(1, tp + fn), 3),
        "false_positive_rate": round(fp / max(1, fp + tn), 3),
        "false_negative_rate": round(fn / max(1, fn + tp), 3),
        "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }
    metrics["at_operational_threshold"] = deployed_metrics
    print(f"\nau seuil operationnel {threshold:.3f} (mesure hors pli) :")
    print(json.dumps(deployed_metrics, indent=2, ensure_ascii=False))

    fpr = deployed_metrics["false_positive_rate"]
    recall = deployed_metrics["recall"]
    publishable = threshold_feasible and fpr <= 0.10 and recall >= 0.60
    if publishable:
        print("\nVERDICT : deployable sous canary 5%.")
    else:
        print("\nVERDICT : NON DEPLOYABLE (dataset trop petit / FPR ou recall).")

    quantized = quantize(model, threshold)

    if private_key_path:
        private_key = serialization.load_pem_private_key(
            private_key_path.read_bytes(), password=None
        )
        if not isinstance(private_key, ec.EllipticCurvePrivateKey):
            raise SystemExit("la cle doit etre une cle privee ECDSA (secp256r1).")
    else:
        private_key = ec.generate_private_key(ec.SECP256R1())
        print("\nATTENTION : cle de dev aleatoire.")

    try:
        dataset_ref = str(benchmark.resolve().relative_to(repo_root()))
    except ValueError:
        dataset_ref = str(benchmark)
    patch = build_patch(
        quantized,
        metrics,
        len(texts),
        private_key,
        publishable,
        dataset_ref=dataset_ref,
    )

    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    print(f"cle publique (a embarquer dans l'app) : {public_key.hex()}")

    mismatches = 0
    for features, label in zip(X, y, strict=True):
        vector = [int(v) for v in features]
        predicted = (
            1 if score_from_quantized(quantized, vector) >= quantized["threshold_score"] else 0
        )
        if predicted != label:
            mismatches += 1
    print(f"\ndesaccord entier/flottant sur l'entrainement : {mismatches}/{len(texts)}")

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(patch, indent=2, ensure_ascii=False), encoding="utf-8")
    checksum = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f"patch ecrit : {out}")
    print(f"sha256 : {checksum}")

    result = {
        "path": str(out),
        "checksum_sha256": checksum,
        "publishable": publishable,
        "status": patch["status"],
        "metrics": metrics,
        "samples": len(texts),
        "model_version": MODEL_VERSION,
        "public_key_hex": public_key.hex(),
    }

    if register:
        register_artifact(
            {
                "id": f"local-logistic-v{MODEL_VERSION}-{checksum[:8]}",
                "format": "signed_json_logistic",
                "official_for_mobile": True,
                "note": (
                    "Artefact officiel signable/diffable. TFLite reste un export "
                    "optionnel pour le runtime Expo actuel (float32)."
                ),
                "path": str(out.relative_to(repo_root())) if out.is_relative_to(repo_root()) else str(out),
                "checksum_sha256": checksum,
                "status": patch["status"],
                "publishable": publishable,
                "metrics": deployed_metrics,
                "samples": len(texts),
                "trained_at": patch["training"]["trained_at"],
            }
        )
        print("registry mis a jour : models/metadata/model_registry.json")

    return result
