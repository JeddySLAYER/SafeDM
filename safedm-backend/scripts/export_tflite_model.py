#!/usr/bin/env python3
"""Optional TFLite export for the Expo runtime (float32).

Official signed artefact remains the integer logistic JSON from
``scripts/train_local_model.py`` / ``ml.models.training``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.data.loaders import load_labeled_messages  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--metadata", type=Path)
    args = parser.parse_args()

    try:
        import tensorflow as tf
        from sklearn.linear_model import LogisticRegression
    except ImportError as exc:
        raise SystemExit(
            "TensorFlow et scikit-learn sont requis uniquement pour exporter le modèle. "
            "Utilisez un environnement Python 3.11/3.12 de build."
        ) from exc

    features, labels, _ = load_labeled_messages()
    classifier = LogisticRegression(
        C=0.5,
        max_iter=2000,
        class_weight="balanced",
        solver="liblinear",
    )
    classifier.fit(features, labels)

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(features.shape[1],), dtype=tf.float32),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.layers[0].set_weights(
        [
            classifier.coef_.reshape(features.shape[1], 1).astype(np.float32),
            classifier.intercept_.astype(np.float32),
        ]
    )

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = []
    tflite_model = converter.convert()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(tflite_model)

    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    interpreter.allocate_tensors()
    input_info = interpreter.get_input_details()[0]
    output_info = interpreter.get_output_details()[0]
    metadata = {
        "model_version": 1,
        "feature_count": int(features.shape[1]),
        "input": {
            "shape": input_info["shape"].tolist(),
            "dtype": np.dtype(input_info["dtype"]).name,
        },
        "output": {
            "shape": output_info["shape"].tolist(),
            "dtype": np.dtype(output_info["dtype"]).name,
        },
        "dataset_samples": int(features.shape[0]),
        "training": "scikit-learn LogisticRegression mirrored in Keras Dense(sigmoid)",
        "official_artefact": "signed_json_logistic (see make train)",
    }
    metadata_path = args.metadata or args.out.with_suffix(".json")
    metadata_path.write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(metadata, indent=2))
    print(f"model: {args.out} ({len(tflite_model)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
