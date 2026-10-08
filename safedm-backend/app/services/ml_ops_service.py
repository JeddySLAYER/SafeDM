"""Admin ML ops: datasets, train runs, promote to canary patch path."""

from __future__ import annotations

import csv
import io
import json
import logging
import sys
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.ml_ops import MlDataset, MlTrainRun
from app.models.user import User

# Ensure backend root is importable when serving under FastAPI Cloud / uvicorn.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from ml.data.loaders import BENIGN_LABELS, repo_root  # noqa: E402
from ml.models.training import train_and_export  # noqa: E402

logger = logging.getLogger(__name__)

MAX_SAMPLES = 50_000


def _parse_cases(raw: str | list | dict) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        cases = raw
    elif isinstance(raw, dict) and "cases" in raw:
        cases = raw["cases"]
    elif isinstance(raw, str):
        text = raw.strip()
        if text.startswith("[") or text.startswith("{"):
            parsed = json.loads(text)
            return _parse_cases(parsed)
        # CSV: message,expected
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or "message" not in {f.lower() for f in reader.fieldnames}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV requis: colonnes message,expected (ou JSON liste).",
            )
        field_map = {f.lower(): f for f in reader.fieldnames}
        if "expected" not in field_map and "label" not in field_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV requis: colonnes message,expected",
            )
        exp_key = field_map.get("expected") or field_map["label"]
        cases = []
        for row in reader:
            cases.append(
                {
                    "message": row[field_map["message"]],
                    "expected": row[exp_key],
                }
            )
    else:
        raise HTTPException(status_code=400, detail="Format dataset invalide")

    cleaned: list[dict[str, Any]] = []
    for i, case in enumerate(cases):
        if not isinstance(case, dict):
            raise HTTPException(status_code=400, detail=f"Case {i}: objet attendu")
        msg = (case.get("message") or case.get("text") or "").strip()
        expected = (case.get("expected") or case.get("label") or "").strip().lower()
        if not msg or not expected:
            raise HTTPException(status_code=400, detail=f"Case {i}: message+expected requis")
        cleaned.append({"message": msg, "expected": expected, **{
            k: v for k, v in case.items() if k not in ("message", "text", "expected", "label")
        }})
    if not cleaned:
        raise HTTPException(status_code=400, detail="Dataset vide")
    if len(cleaned) > MAX_SAMPLES:
        raise HTTPException(status_code=400, detail=f"Max {MAX_SAMPLES} samples")
    return cleaned


def _label_counts(cases: list[dict[str, Any]]) -> tuple[int, int]:
    benign = sum(1 for c in cases if c["expected"] in BENIGN_LABELS)
    return benign, len(cases) - benign


class MlOpsService:
    def __init__(self, db: Session):
        self.db = db

    def list_datasets(self) -> list[dict[str, Any]]:
        rows = self.db.query(MlDataset).order_by(MlDataset.id.desc()).limit(100).all()
        return [self._dataset_public(r) for r in rows]

    def get_dataset(self, dataset_id: int) -> dict[str, Any]:
        row = self.db.get(MlDataset, dataset_id)
        if not row:
            raise HTTPException(status_code=404, detail="Dataset introuvable")
        return self._dataset_public(row, include_preview=True)

    def create_dataset(
        self,
        *,
        name: str,
        content: str | list | dict,
        source: str,
        admin: User,
    ) -> dict[str, Any]:
        cases = _parse_cases(content)
        benign, malicious = _label_counts(cases)
        row = MlDataset(
            name=name.strip() or f"dataset-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}",
            source=source or "upload",
            sample_count=len(cases),
            benign_count=benign,
            malicious_count=malicious,
            content_json=json.dumps(cases, ensure_ascii=False),
            created_by_user_id=admin.id,
        )
        self.db.add(row)
        self.db.flush()
        return self._dataset_public(row)

    def seed_builtin(self, admin: User) -> dict[str, Any]:
        """Import repo processed labeled_messages.json if present."""
        path = repo_root() / "data" / "processed" / "labeled_messages.json"
        if not path.exists():
            path = repo_root() / "tests" / "fixtures" / "jev_benchmark_baseline.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="Aucun dataset built-in trouvé")
        return self.create_dataset(
            name=f"builtin:{path.name}",
            content=path.read_text(encoding="utf-8"),
            source="builtin",
            admin=admin,
        )

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = (
            self.db.query(MlTrainRun)
            .order_by(MlTrainRun.id.desc())
            .limit(limit)
            .all()
        )
        return [self._run_public(r) for r in rows]

    def get_run(self, run_id: int) -> dict[str, Any]:
        row = self.db.get(MlTrainRun, run_id)
        if not row:
            raise HTTPException(status_code=404, detail="Run introuvable")
        return self._run_public(row, full=True)

    def start_train(self, *, dataset_id: int, admin: User, promote_canary: bool = False) -> dict[str, Any]:
        dataset = self.db.get(MlDataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset introuvable")

        run = MlTrainRun(
            dataset_id=dataset.id,
            status="running",
            triggered_by_user_id=admin.id,
        )
        self.db.add(run)
        self.db.flush()

        settings = get_settings()
        work_dir = Path(settings.model_patch_manifest_path).resolve().parent / "train_runs"
        work_dir.mkdir(parents=True, exist_ok=True)
        dataset_file = work_dir / f"dataset_{dataset.id}_{run.id}.json"
        artifact = work_dir / f"patch_run_{run.id}.json"
        dataset_file.write_text(dataset.content_json, encoding="utf-8")

        log_buf = io.StringIO()
        try:
            with redirect_stdout(log_buf):
                result = train_and_export(
                    artifact,
                    private_key_path=None,
                    register=True,
                    dataset_path=dataset_file,
                )
            run.status = "succeeded"
            run.publishable = bool(result.get("publishable"))
            run.metrics_json = json.dumps(result.get("metrics") or {}, ensure_ascii=False)
            run.artifact_path = str(artifact)
            run.artifact_sha256 = result.get("checksum_sha256")
            run.log_text = log_buf.getvalue()[-80_000:]
            run.finished_at = datetime.now(timezone.utc)

            if promote_canary and result.get("publishable"):
                self._promote_artifact(artifact)
                run.log_text = (run.log_text or "") + "\n[promote] copied to MODEL_PATCH_MANIFEST_PATH\n"
            elif promote_canary and not result.get("publishable"):
                run.log_text = (run.log_text or "") + "\n[promote] skipped: not publishable\n"

        except Exception as exc:  # noqa: BLE001 — surface to admin UI
            logger.exception("train run %s failed", run.id)
            run.status = "failed"
            run.error_message = str(exc)[:2000]
            run.log_text = log_buf.getvalue()[-80_000:]
            run.finished_at = datetime.now(timezone.utc)

        self.db.flush()
        return self._run_public(run, full=True)

    def promote_run(self, run_id: int) -> dict[str, Any]:
        run = self.db.get(MlTrainRun, run_id)
        if not run or run.status != "succeeded" or not run.artifact_path:
            raise HTTPException(status_code=400, detail="Run non promuable")
        path = Path(run.artifact_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Artefact disparu (FS éphémère?)")
        self._promote_artifact(path)
        return {"ok": True, "manifest": get_settings().model_patch_manifest_path, "run_id": run.id}

    def _promote_artifact(self, artifact: Path) -> None:
        target = Path(get_settings().model_patch_manifest_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(artifact.read_bytes())

    @staticmethod
    def _dataset_public(row: MlDataset, *, include_preview: bool = False) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": row.id,
            "name": row.name,
            "source": row.source,
            "sample_count": row.sample_count,
            "benign_count": row.benign_count,
            "malicious_count": row.malicious_count,
            "created_by_user_id": row.created_by_user_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        if include_preview:
            try:
                cases = json.loads(row.content_json)
                out["preview"] = cases[:5]
            except json.JSONDecodeError:
                out["preview"] = []
        return out

    @staticmethod
    def _run_public(row: MlTrainRun, *, full: bool = False) -> dict[str, Any]:
        metrics = None
        if row.metrics_json:
            try:
                metrics = json.loads(row.metrics_json)
            except json.JSONDecodeError:
                metrics = None
        out: dict[str, Any] = {
            "id": row.id,
            "dataset_id": row.dataset_id,
            "status": row.status,
            "publishable": row.publishable,
            "artifact_sha256": row.artifact_sha256,
            "error_message": row.error_message,
            "triggered_by_user_id": row.triggered_by_user_id,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "finished_at": row.finished_at.isoformat() if row.finished_at else None,
            "metrics_summary": None,
        }
        if metrics and isinstance(metrics.get("at_operational_threshold"), dict):
            out["metrics_summary"] = metrics["at_operational_threshold"]
        if full:
            out["metrics"] = metrics
            out["log_text"] = row.log_text
            out["artifact_path"] = row.artifact_path
        return out
