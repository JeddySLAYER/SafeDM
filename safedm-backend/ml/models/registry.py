"""Simple JSON model registry (no MLflow)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ml.data.loaders import repo_root


def registry_path() -> Path:
    return repo_root() / "models" / "metadata" / "model_registry.json"


def load_registry() -> dict[str, Any]:
    path = registry_path()
    if not path.exists():
        return {"models": [], "updated_at": None}
    return json.loads(path.read_text(encoding="utf-8"))


def register_artifact(entry: dict[str, Any]) -> Path:
    """Append an artefact entry and write the registry file."""
    path = registry_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = load_registry()
    models = list(data.get("models") or [])
    models.append(entry)
    payload = {
        "updated_at": datetime.now(UTC).isoformat(),
        "models": models,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path
