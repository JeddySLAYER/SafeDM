"""Run the bundled mobile TFLite model and compare it with an integer patch."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.ml_ops import MlDataset, MlTrainRun
from app.utils.feature_extraction import FEATURE_NAMES, extract_features
from ml.data.loaders import BENIGN_LABELS, default_benchmark_path, repo_root
from ml.models.training import score_from_quantized

SAFE_THRESHOLD = 0.40
DANGEROUS_THRESHOLD = 0.85
MAX_DIAGNOSTIC_ROWS = 5000


def _json_native(value: Any) -> Any:
    """Convert NumPy values anywhere in a response to standard JSON primitives."""
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return [_json_native(item) for item in value.tolist()]
    if isinstance(value, dict):
        return {key: _json_native(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_native(item) for item in value]
    return value


def _dataset_cases(db, dataset_id: int) -> list[dict[str, Any]]:
    dataset = db.get(MlDataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset introuvable")
    try:
        cases = json.loads(dataset.content_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Dataset JSON invalide") from exc
    if not isinstance(cases, list) or not cases:
        raise HTTPException(status_code=422, detail="Le dataset ne contient aucun exemple")
    if len(cases) > MAX_DIAGNOSTIC_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"Limite du diagnostic : {MAX_DIAGNOSTIC_ROWS} messages par exécution",
        )
    return cases


def _training_overlap(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Flag exact training examples so an in-sample score is never presented as validation."""
    benchmark = default_benchmark_path()
    if not benchmark.is_file():
        return {"checked": False, "exact_overlap": 0, "training_reference_count": None, "warning": None}
    try:
        training_cases = json.loads(benchmark.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"checked": False, "exact_overlap": 0, "training_reference_count": None, "warning": None}
    normalize = lambda value: " ".join(str(value or "").casefold().split())
    training_messages = {
        normalize(case.get("message") or case.get("text"))
        for case in training_cases
        if isinstance(case, dict) and normalize(case.get("message") or case.get("text"))
    }
    valid_messages = [
        normalize(case.get("message") or case.get("text"))
        for case in cases
        if isinstance(case, dict) and normalize(case.get("message") or case.get("text"))
    ]
    overlap = sum(message in training_messages for message in valid_messages)
    warning = None
    if overlap:
        warning = (
            f"{overlap}/{len(valid_messages)} messages du diagnostic sont aussi dans le jeu utilisé pour entraîner le TFLite. "
            "Ces scores mesurent une reconnaissance in-sample, pas la généralisation; utilisez un jeu indépendant."
        )
    return {
        "checked": True,
        "exact_overlap": overlap,
        "training_reference_count": len(training_messages),
        "diagnostic_count": len(valid_messages),
        "warning": warning,
    }


def _get_patch(db, run_id: int | None) -> tuple[dict[str, Any] | None, str | None]:
    if run_id is not None:
        run = db.get(MlTrainRun, run_id)
        if not run or not run.artifact_path:
            raise HTTPException(status_code=404, detail="Run sans artefact de modèle")
        path = Path(run.artifact_path)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Artefact du run introuvable sur le disque")
        return json.loads(path.read_text(encoding="utf-8")), f"run:{run_id}"

    path = Path(get_settings().model_patch_manifest_path)
    if not path.is_file():
        return None, None
    loaded = json.loads(path.read_text(encoding="utf-8"))
    patch = loaded.get("patch") if isinstance(loaded, dict) else None
    if not isinstance(patch, dict) and isinstance(loaded, dict) and loaded.get("quantization"):
        patch = loaded
    if not isinstance(patch, dict) or not isinstance(patch.get("quantization"), dict):
        return None, None
    return patch, f"manifest:{loaded.get('version') or path.name}"


def _load_interpreter(model_path: Path):
    try:
        from ai_edge_litert.interpreter import Interpreter
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Interpréteur LiteRT indisponible. Installez les dépendances du backend "
                "(uv sync), puis redémarrez l’API."
            ),
        ) from exc
    if not model_path.is_file():
        raise HTTPException(status_code=404, detail=f"Fichier TFLite introuvable : {model_path}")
    try:
        interpreter = Interpreter(model_path=str(model_path))
        interpreter.allocate_tensors()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Impossible de charger le TFLite : {exc}") from exc
    inputs = interpreter.get_input_details()
    outputs = interpreter.get_output_details()
    if len(inputs) != 1 or len(outputs) != 1:
        raise HTTPException(status_code=422, detail="Le diagnostic attend un modèle à une entrée et une sortie")
    input_shape = tuple(int(v) for v in inputs[0]["shape"])
    if input_shape != (1, len(FEATURE_NAMES)):
        raise HTTPException(
            status_code=422,
            detail=f"Entrée TFLite incompatible : forme {input_shape}, attendu (1, {len(FEATURE_NAMES)})",
        )
    return interpreter, inputs[0], outputs[0]


def evaluate_tflite_dataset(
    db,
    *,
    dataset_id: int,
    run_id: int | None = None,
    mobile_features: list[list[int]] | None = None,
    mobile_results: list[dict[str, Any]] | None = None,
    mobile_messages: list[str] | None = None,
    model_path_override: Path | None = None,
    model_source: str = "bundled",
    model_filename: str | None = None,
    model_sha256: str | None = None,
) -> dict[str, Any]:
    """Evaluate a bundled or uploaded .tflite on stored labeled messages."""
    cases = _dataset_cases(db, dataset_id)
    overlap = _training_overlap(cases)
    if mobile_features is not None and len(mobile_features) != len(cases):
        raise HTTPException(
            status_code=422,
            detail=f"Le rapport Android contient {len(mobile_features)} vecteurs pour {len(cases)} exemples.",
        )
    if mobile_results is not None and len(mobile_results) != len(cases):
        raise HTTPException(status_code=422, detail="Le rapport Android ne correspond pas au nombre de messages du dataset.")
    if mobile_messages is not None and len(mobile_messages) != len(cases):
        raise HTTPException(status_code=422, detail="Le rapport Android ne correspond pas au nombre de messages du dataset.")
    root = repo_root()
    model_path = model_path_override or (root.parent / "safedm-mobile" / "assets" / "models" / "safedm_v3.tflite")
    interpreter, input_info, output_info = _load_interpreter(model_path)
    production_interpreter = None
    production_input = production_output = None
    production_path = root.parent / "safedm-mobile" / "assets" / "models" / "safedm_v3.tflite"
    if model_path.resolve() != production_path.resolve() and production_path.is_file():
        production_interpreter, production_input, production_output = _load_interpreter(production_path)
    patch, patch_source = _get_patch(db, run_id)
    quantized = patch.get("quantization") if patch else None
    if patch and (not isinstance(quantized, dict) or not isinstance(quantized.get("weights"), list)):
        raise HTTPException(status_code=422, detail="Patch sélectionné sans poids entiers")

    rows: list[dict[str, Any]] = []
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            continue
        message = str(case.get("message") or case.get("text") or "").strip()
        expected = str(case.get("expected") or case.get("label") or "").strip().lower()
        if not message or not expected:
            continue
        if mobile_messages is not None and mobile_messages[index] != message:
            raise HTTPException(
                status_code=422,
                detail=f"Le message Android #{index + 1} ne correspond pas au dataset sélectionné. Choisissez le même jeu sur le téléphone.",
            )

        # Match the model export benchmark: URL reputation unknown (128), no app context.
        features = [int(v) for v in extract_features(message, known_bad_url=128)]
        if len(features) != len(FEATURE_NAMES):
            raise HTTPException(status_code=422, detail=f"Exemple {index + 1}: vecteur Python invalide")
        phone_features = mobile_features[index] if mobile_features is not None else None
        if phone_features is not None and (
            len(phone_features) != len(FEATURE_NAMES)
            or any(not isinstance(value, int) or value < 0 or value > 255 for value in phone_features)
        ):
            raise HTTPException(status_code=422, detail=f"Exemple {index + 1}: vecteur Android invalide (50 entiers uint8 attendus)")
        feature_differences = (
            [
                {"index": i, "name": FEATURE_NAMES[i], "python": value, "android": phone_features[i]}
                for i, value in enumerate(features)
                if value != phone_features[i]
            ]
            if phone_features is not None
            else None
        )
        mobile_result = mobile_results[index] if mobile_results is not None else None
        if mobile_result is not None:
            try:
                mobile_probability = float(mobile_result["probability"])
                mobile_decision = str(mobile_result["decision"])
            except (KeyError, TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail=f"Exemple {index + 1}: score ou décision Android manquant") from exc
            if not np.isfinite(mobile_probability) or not 0 <= mobile_probability <= 1:
                raise HTTPException(status_code=422, detail=f"Exemple {index + 1}: score Android hors intervalle [0,1]")
            if mobile_decision not in {"SAFE", "UNCERTAIN", "DANGEROUS"}:
                raise HTTPException(status_code=422, detail=f"Exemple {index + 1}: décision Android invalide")
            mobile_decision_normalized = {
                "SAFE": "BENIN",
                "UNCERTAIN": "INCERTAIN",
                "DANGEROUS": "DANGEREUX",
            }[mobile_decision]
        else:
            mobile_probability = None
            mobile_decision = None
            mobile_decision_normalized = None
        input_tensor = np.asarray(features, dtype=input_info["dtype"]).reshape(input_info["shape"])
        try:
            interpreter.set_tensor(input_info["index"], input_tensor)
            interpreter.invoke()
            output = np.asarray(interpreter.get_tensor(output_info["index"])).reshape(-1)
            probability = float(output[0])
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Inférence TFLite exemple {index + 1}: {exc}") from exc
        if not np.isfinite(probability) or not 0 <= probability <= 1:
            raise HTTPException(status_code=422, detail=f"Sortie TFLite invalide à l’exemple {index + 1}")
        production_probability = None
        if production_interpreter is not None:
            production_interpreter.set_tensor(production_input["index"], np.asarray(features, dtype=production_input["dtype"]).reshape(production_input["shape"]))
            production_interpreter.invoke()
            production_probability = float(np.asarray(production_interpreter.get_tensor(production_output["index"])).reshape(-1)[0])

        tflite_decision = (
            "DANGEREUX" if probability >= DANGEROUS_THRESHOLD
            else "INCERTAIN" if probability >= SAFE_THRESHOLD
            else "BENIN"
        )
        expected_malicious = expected not in BENIGN_LABELS
        patch_decision = None
        patch_score = None
        if quantized:
            if len(quantized["weights"]) != len(features):
                raise HTTPException(status_code=422, detail="Dimension du patch incompatible avec 50 features")
            patch_score = int(score_from_quantized(quantized, features))
            patch_decision = patch_score >= int(quantized["threshold_score"])

        rows.append({
            "index": index,
            "message": message,
            "expected": expected,
            "expected_binary": "MALVEILLANT" if expected_malicious else "BENIN",
            "python_features": features,
            "mobile_features": phone_features,
            "feature_differences": feature_differences,
            "features_match": not feature_differences if feature_differences is not None else None,
            "mobile_probability": mobile_probability,
            "mobile_decision": mobile_decision,
            "tflite_mobile_score_delta": abs(probability - mobile_probability) if mobile_probability is not None else None,
            "tflite_mobile_decision_match": tflite_decision == mobile_decision_normalized if mobile_decision else None,
            "tflite_probability": probability,
            "production_probability": production_probability,
            "production_decision": (
                "DANGEREUX" if production_probability is not None and production_probability >= DANGEROUS_THRESHOLD
                else "INCERTAIN" if production_probability is not None and production_probability >= SAFE_THRESHOLD
                else "BENIN" if production_probability is not None else None
            ),
            "tflite_decision": tflite_decision,
            "tflite_binary_dangerous": probability >= DANGEROUS_THRESHOLD,
            "patch_score": patch_score,
            "patch_decision": "MALVEILLANT" if patch_decision is True else "BENIN" if patch_decision is False else None,
            "patch_matches_tflite_dangerous": patch_decision == (probability >= DANGEROUS_THRESHOLD) if patch_decision is not None else None,
        })

    if not rows:
        raise HTTPException(status_code=422, detail="Aucun exemple avec message et étiquette exploitable")

    benign = [row for row in rows if row["expected_binary"] == "BENIN"]
    malicious = [row for row in rows if row["expected_binary"] == "MALVEILLANT"]
    tflite_metrics = {
        "benign": len(benign),
        "malicious": len(malicious),
        "benign_dangerous": sum(row["tflite_decision"] == "DANGEREUX" for row in benign),
        "malicious_safe": sum(row["tflite_decision"] == "BENIN" for row in malicious),
        "malicious_uncertain": sum(row["tflite_decision"] == "INCERTAIN" for row in malicious),
        "benign_uncertain": sum(row["tflite_decision"] == "INCERTAIN" for row in benign),
    }
    patch_rows = [row for row in rows if row["patch_decision"] is not None]
    patch_metrics = None
    if patch_rows:
        patch_benign = [row for row in patch_rows if row["expected_binary"] == "BENIN"]
        patch_malicious = [row for row in patch_rows if row["expected_binary"] == "MALVEILLANT"]
        patch_metrics = {
            "benign": len(patch_benign),
            "malicious": len(patch_malicious),
            "benign_dangerous": sum(row["patch_decision"] == "MALVEILLANT" for row in patch_benign),
            "malicious_safe": sum(row["patch_decision"] == "BENIN" for row in patch_malicious),
        }
    def confusion(predicted_key: str, dangerous_value: str = "DANGEREUX") -> dict[str, int]:
        return {
            "tn": sum(row["expected_binary"] == "BENIN" and row[predicted_key] != dangerous_value for row in rows),
            "fp": sum(row["expected_binary"] == "BENIN" and row[predicted_key] == dangerous_value for row in rows),
            "fn": sum(row["expected_binary"] == "MALVEILLANT" and row[predicted_key] != dangerous_value for row in rows),
            "tp": sum(row["expected_binary"] == "MALVEILLANT" and row[predicted_key] == dangerous_value for row in rows),
        }

    def class_metrics(subset: list[dict[str, Any]], predicted_key: str) -> dict[str, Any]:
        if not subset:
            return {"count": 0, "correct": 0, "accuracy": None}
        correct = sum(
            (row["expected_binary"] == "MALVEILLANT") == (row[predicted_key] == "DANGEREUX")
            for row in subset
        )
        return {"count": len(subset), "correct": correct, "accuracy": correct / len(subset)}

    tflite_confusion = confusion("tflite_decision")
    tflite_class = {
        "BENIN": class_metrics(benign, "tflite_decision"),
        "MALVEILLANT": class_metrics(malicious, "tflite_decision"),
    }
    production_rows = [row for row in rows if row["production_decision"] is not None]
    production_confusion = None
    if production_rows:
        production_confusion = {
            "tn": sum(row["expected_binary"] == "BENIN" and row["production_decision"] != "DANGEREUX" for row in production_rows),
            "fp": sum(row["expected_binary"] == "BENIN" and row["production_decision"] == "DANGEREUX" for row in production_rows),
            "fn": sum(row["expected_binary"] == "MALVEILLANT" and row["production_decision"] != "DANGEREUX" for row in production_rows),
            "tp": sum(row["expected_binary"] == "MALVEILLANT" and row["production_decision"] == "DANGEREUX" for row in production_rows),
        }
    slices = {}
    for slice_name, predicate in (
        ("benign", lambda row: row["expected_binary"] == "BENIN"),
        ("malicious", lambda row: row["expected_binary"] == "MALVEILLANT"),
        ("uncertain", lambda row: row["tflite_decision"] == "INCERTAIN"),
    ):
        selected = [row for row in rows if predicate(row)]
        slices[slice_name] = {"count": len(selected), "indices": [row["index"] for row in selected[:100]]}
    parity_rows = [row for row in rows if row["patch_matches_tflite_dangerous"] is not None]
    feature_rows = [row for row in rows if row["features_match"] is not None]
    mobile_rows = [row for row in rows if row["mobile_probability"] is not None]
    return _json_native({
        "dataset_id": dataset_id,
        "sample_count": len(rows),
        "data_quality": overlap,
        "model": {
            "source": model_source,
            "filename": model_filename,
            "sha256": model_sha256,
            "path": str(model_path) if model_source == "bundled" else None,
            "bytes": model_path.stat().st_size,
            "input_shape": list(input_info["shape"]),
            "input_dtype": str(input_info["dtype"]),
            "output_shape": list(output_info["shape"]),
            "output_dtype": str(output_info["dtype"]),
            "thresholds": {"safe_below": SAFE_THRESHOLD, "dangerous_from": DANGEROUS_THRESHOLD},
        },
        "features": {"count": len(FEATURE_NAMES), "names": list(FEATURE_NAMES), "source": "python_reference", "mobile_vectors_received": len(feature_rows)},
        "tflite": tflite_metrics,
        "metrics": {
            "confusion_matrix": tflite_confusion,
            "per_class": tflite_class,
            "slices": slices,
            "production_comparison": {
                "available": production_confusion is not None,
                "confusion_matrix": production_confusion,
                "rows_compared": len(production_rows),
                "same_decision": sum(
                    row["tflite_decision"] == row["production_decision"] for row in production_rows
                ),
            },
        },
        "patch": {"source": patch_source, **patch_metrics} if patch_metrics else None,
        "parity": {
            "patch_comparable_samples": len(parity_rows),
            "tflite_patch_same_binary_decision": sum(bool(row["patch_matches_tflite_dangerous"]) for row in parity_rows),
            "feature_rows_compared": len(feature_rows),
            "feature_rows_exact": sum(bool(row["features_match"]) for row in feature_rows),
            "feature_value_mismatches": sum(len(row["feature_differences"] or []) for row in feature_rows),
            "feature_parity_checked": bool(feature_rows),
            "mobile_score_rows_compared": len(mobile_rows),
            "mobile_score_max_delta": max((row["tflite_mobile_score_delta"] for row in mobile_rows), default=None),
            "mobile_score_exact_decisions": sum(bool(row["tflite_mobile_decision_match"]) for row in mobile_rows),
            "note": "Les vecteurs Android sont fournis par le rapport mobile." if feature_rows else "Importez un rapport de vecteurs produit par l’app pour vérifier la parité Android.",
        },
        "rows": rows,
    })
