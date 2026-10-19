import json
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi import HTTPException

pytest.importorskip("ai_edge_litert")

from ai_edge_litert.interpreter import Interpreter

from app.models.ml_ops import MlDataset
from app.utils.feature_extraction import extract_features
from ml.data.loaders import repo_root
from ml.evaluation.tflite_diagnostics import evaluate_tflite_dataset


class FakeDb:
    def __init__(self, cases):
        self.dataset = SimpleNamespace(content_json=json.dumps(cases))

    def get(self, model, _key):
        assert model is MlDataset
        return self.dataset


def test_evaluates_bundled_tflite_and_compares_mobile_vectors():
    cases = [
        {"message": "Salut, on se voit demain ?", "expected": "legitimate"},
        {"message": "URGENT validez votre compte https://bank-secure.example/login", "expected": "phishing"},
    ]
    vectors = [extract_features(row["message"], known_bad_url=128) for row in cases]
    model_path = repo_root().parent / "safedm-mobile/assets/models/safedm_v3.tflite"
    interpreter = Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    input_info = interpreter.get_input_details()[0]
    output_info = interpreter.get_output_details()[0]
    mobile_results = []
    for vector in vectors:
        interpreter.set_tensor(input_info["index"], np.asarray(vector, dtype=np.float32).reshape(1, 50))
        interpreter.invoke()
        probability = float(interpreter.get_tensor(output_info["index"])[0][0])
        decision = "DANGEROUS" if probability >= 0.85 else "UNCERTAIN" if probability >= 0.4 else "SAFE"
        mobile_results.append({"probability": probability, "decision": decision})

    result = evaluate_tflite_dataset(
        FakeDb(cases),
        dataset_id=12,
        mobile_features=vectors,
        mobile_results=mobile_results,
        mobile_messages=[row["message"] for row in cases],
    )

    assert result["sample_count"] == 2
    assert result["model"]["input_shape"] == [1, 50]
    assert result["features"]["mobile_vectors_received"] == 2
    assert result["parity"]["feature_rows_exact"] == 2
    assert result["parity"]["feature_value_mismatches"] == 0
    assert result["parity"]["mobile_score_max_delta"] == 0
    assert result["parity"]["mobile_score_exact_decisions"] == 2
    assert result["metrics"]["confusion_matrix"]["tp"] + result["metrics"]["confusion_matrix"]["fn"] == 1
    assert result["metrics"]["per_class"]["BENIN"]["count"] == 1
    assert result["metrics"]["slices"]["malicious"]["count"] == 1
    json.dumps(result)


def test_rejects_mobile_vectors_from_another_message_order():
    cases = [{"message": "Bonjour", "expected": "legitimate"}]
    with pytest.raises(HTTPException, match="ne correspond pas au dataset"):
        evaluate_tflite_dataset(
            FakeDb(cases),
            dataset_id=12,
            mobile_features=[extract_features("Bonjour", known_bad_url=128)],
            mobile_messages=["Autre message"],
        )
