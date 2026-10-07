"""Evaluate current dataset / optional artefact without publishing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sklearn.linear_model import LogisticRegression

from ml.data.loaders import load_labeled_messages
from ml.evaluation.metrics import (
    cross_val_metrics,
    decide_threshold,
    out_of_fold_probabilities,
)
from ml.features import FEATURE_COUNT, extract_features


def feature_parity_smoke(limit: int = 5) -> dict:
    """Smoke: extract_features returns FEATURE_COUNT uint8 values."""
    samples = [
        "URGENT validez votre compte https://bank-secure.example/login",
        "Salut, on se voit demain ?",
        "Votre colis est en attente : cliquez bit.ly/xyz",
    ]
    ok = 0
    for text in samples[:limit]:
        vec = extract_features(text, known_bad_url=128)
        if len(vec) == FEATURE_COUNT and all(0 <= int(v) <= 255 for v in vec):
            ok += 1
    return {"checked": min(limit, len(samples)), "ok": ok, "feature_count": FEATURE_COUNT}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate SafeDM local model metrics")
    parser.add_argument(
        "--json-out",
        type=Path,
        help="Write metrics JSON to this path (default: stdout only)",
    )
    args = parser.parse_args(argv)

    parity = feature_parity_smoke()
    X, y, _texts = load_labeled_messages()
    model = LogisticRegression(
        C=0.5, max_iter=2000, class_weight="balanced", solver="liblinear"
    )
    model.fit(X, y)
    metrics = cross_val_metrics(model, X, y)
    oof, _ = out_of_fold_probabilities(model, X, y)
    threshold = decide_threshold(oof, y)

    payload = {
        "feature_parity": parity,
        "cv_metrics": metrics,
        "operational_threshold": threshold,
        "samples": int(X.shape[0]),
        "features": int(X.shape[1]),
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    print(text)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text + "\n", encoding="utf-8")
    return 0 if parity["ok"] == parity["checked"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
