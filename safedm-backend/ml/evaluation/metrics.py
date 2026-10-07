"""Training metrics — never report in-sample accuracy as generalization."""

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import StratifiedKFold, cross_val_predict


def cross_val_metrics(model: LogisticRegression, X: np.ndarray, y: np.ndarray) -> dict:
    n_splits = min(5, int(np.bincount(y).min()))
    if n_splits < 2:
        return {"cv_folds": 0, "note": "trop peu d'exemples pour une validation croisee"}

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    predictions = cross_val_predict(model, X, y, cv=cv)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y, predictions, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(y, predictions, labels=[0, 1]).ravel()
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    fnr = fn / (fn + tp) if (fn + tp) else 0.0
    return {
        "cv_folds": n_splits,
        "precision": round(float(precision), 3),
        "recall": round(float(recall), 3),
        "f1": round(float(f1), 3),
        "false_positive_rate": round(float(fpr), 3),
        "false_negative_rate": round(float(fnr), 3),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def out_of_fold_probabilities(
    model: LogisticRegression, X: np.ndarray, y: np.ndarray
) -> tuple[np.ndarray, int]:
    n_splits = min(5, int(np.bincount(y).min()))
    if n_splits < 2:
        return model.predict_proba(X)[:, 1], 0
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    return cross_val_predict(model, X, y, cv=cv, method="predict_proba")[:, 1], n_splits


def decide_threshold(
    probabilities: np.ndarray, y: np.ndarray, max_fpr: float = 0.10
) -> float | None:
    benign_total = int((y == 0).sum())
    if benign_total == 0:
        return None

    best_threshold, best_score = None, -1.0
    for threshold in np.linspace(0.20, 0.95, 76):
        predictions = (probabilities >= threshold).astype(int)
        tp = int(((predictions == 1) & (y == 1)).sum())
        fp = int(((predictions == 1) & (y == 0)).sum())
        if fp / benign_total > max_fpr:
            continue
        score = tp - 2 * fp
        if score > best_score:
            best_score, best_threshold = score, float(threshold)

    if best_threshold is None:
        predictions = (probabilities >= 0.20).astype(int)
        fp = int(((predictions == 1) & (y == 0)).sum())
        achievable = fp / benign_total
        print(
            f"\nAUCUN seuil ne respecte FPR <= {max_fpr:.0%}. "
            f"Le meilleur atteignable au seuil le plus bas (0.20) est "
            f"{achievable:.1%} : {fp}/{benign_total} faux positifs."
        )
    return best_threshold
