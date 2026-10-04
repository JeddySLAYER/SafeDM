#!/usr/bin/env python3
"""Export the trained SafeDM 50-feature classifier to TensorFlow Lite.

This is a build-time tool. TensorFlow is intentionally not a backend runtime
dependency: the API does not train or execute this model.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from train_local_model import load_dataset


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

    features, labels, _ = load_dataset()
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
