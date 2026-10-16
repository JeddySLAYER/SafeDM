"""Admin ML ops: datasets, train runs, promote to canary patch path."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import sys
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CommunityReport, User
from app.models.admin_operations import PatchDeployment
from app.models.enums import ReportStatus
from app.models.ml_ops import MlDataset, MlTrainRun
from app.models.threat import Threat

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

    def create_dataset_from_reports(
        self,
        *,
        name: str,
        items: list[dict[str, Any]],
        admin: User,
    ) -> dict[str, Any]:
        """Create a reviewed dataset from active reports with stored message content."""
        report_ids = [int(item["report_id"]) for item in items]
        if len(report_ids) != len(set(report_ids)):
            raise HTTPException(status_code=400, detail="Un signalement apparaît plusieurs fois")

        labels_by_id = {int(item["report_id"]): str(item["expected"]).strip().lower() for item in items}
        invalid = [report_id for report_id, label in labels_by_id.items() if label not in {"legitimate", "malicious"}]
        if invalid:
            raise HTTPException(status_code=400, detail="Chaque signalement doit être étiqueté bénin ou malveillant")

        rows = self.db.execute(
            select(CommunityReport, Threat.content)
            .join(Threat, Threat.id == CommunityReport.threat_id)
            .where(CommunityReport.id.in_(report_ids))
        ).all()
        content_by_id = {report.id: content for report, content in rows}
        missing_ids = sorted(set(report_ids) - content_by_id.keys())
        without_content = sorted(report_id for report_id, content in content_by_id.items() if not content or not content.strip())
        withdrawn = sorted(report.id for report, _ in rows if report.status != ReportStatus.ACTIVE)
        unavailable = sorted(set(missing_ids + without_content + withdrawn))
        if unavailable:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Certains signalements sont retirés, introuvables ou sans contenu stocké",
                    "report_ids": unavailable,
                },
            )

        deduplicated: dict[str, dict[str, Any]] = {}
        for report_id in report_ids:
            message = (content_by_id[report_id] or "").strip()
            key = " ".join(message.casefold().split())
            expected = labels_by_id[report_id]
            prior = deduplicated.get(key)
            if prior and prior["expected"] != expected:
                raise HTTPException(
                    status_code=422,
                    detail="Des signalements avec le même texte ont reçu des étiquettes différentes",
                )
            if prior:
                prior["source_report_ids"].append(report_id)
            else:
                deduplicated[key] = {
                    "message": message,
                    "expected": expected,
                    "source_report_ids": [report_id],
                }

        if not deduplicated:
            raise HTTPException(status_code=400, detail="Aucun message utilisable dans le lot")
        return self.create_dataset(
            name=name,
            content=list(deduplicated.values()),
            source="reviewed_reports",
            admin=admin,
        )

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

            pub = result.get("public_key_hex") or ""
            if pub:
                artifact.with_suffix(".pub").write_text(pub, encoding="utf-8")
            if promote_canary and result.get("publishable"):
                self._promote_artifact(artifact, pub)
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
        pub_path = path.with_suffix(".pub")
        pub = pub_path.read_text(encoding="utf-8").strip() if pub_path.exists() else ""
        self._promote_artifact(path, pub)
        return {"ok": True, "manifest": get_settings().model_patch_manifest_path, "run_id": run.id}

    def try_message(self, message: str, *, run_id: int | None = None) -> dict[str, Any]:
        """Score a message with the integer patch (same math as the phone OTA path)."""
        text = (message or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="message requis")

        patch, source = self._load_scoring_patch(run_id)
        quantized = patch.get("quantization") if isinstance(patch, dict) else None
        if not isinstance(quantized, dict) or not isinstance(quantized.get("weights"), list):
            raise HTTPException(status_code=404, detail="Patch sans poids quantifiés")

        from app.utils.feature_extraction import FEATURE_NAMES, extract_features
        from ml.models.training import score_from_quantized

        features = [int(v) for v in extract_features(text)]
        weights = quantized["weights"]
        if len(weights) != len(features):
            raise HTTPException(
                status_code=400,
                detail=f"Dimension incompatible: patch={len(weights)} features={len(features)}",
            )
        score = score_from_quantized(quantized, features)
        threshold = int(quantized["threshold_score"])
        malicious = score >= threshold

        contributions = []
        for name, weight, value in zip(FEATURE_NAMES, weights, features, strict=False):
            contrib = int(weight) * int(value)
            if value and contrib:
                contributions.append(
                    {"name": name, "value": int(value), "weight": int(weight), "contribution": contrib}
                )
        contributions.sort(key=lambda row: abs(row["contribution"]), reverse=True)

        return {
            "source": source,
            "decision": "malicious" if malicious else "benign",
            "malicious": malicious,
            "score": score,
            "threshold_score": threshold,
            "model_version": patch.get("model_version"),
            "feature_count": len(features),
            "top_features": contributions[:8],
            "note": (
                "Décision entière identique au patch JSON OTA du téléphone. "
                "Le TFLite bundlé (float32) est un fallback Expo, pas cet artefact."
            ),
        }

    def _load_scoring_patch(self, run_id: int | None) -> tuple[dict[str, Any], str]:
        if run_id is not None:
            run = self.db.get(MlTrainRun, run_id)
            if not run or not run.artifact_path:
                raise HTTPException(status_code=404, detail="Run introuvable")
            path = Path(run.artifact_path)
            if not path.exists():
                raise HTTPException(status_code=404, detail="Artefact disparu (FS éphémère?)")
            raw = json.loads(path.read_text(encoding="utf-8"))
            return raw, f"run:{run_id}"

        path = Path(get_settings().model_patch_manifest_path)
        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail="Aucun manifeste canary. Choisissez un run ou poussez un modèle d'abord.",
            )
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded.get("patch"), dict):
            return loaded["patch"], f"manifest:{loaded.get('version') or path.name}"
        if isinstance(loaded, dict) and loaded.get("quantization"):
            return loaded, f"manifest:{path.name}"
        raise HTTPException(status_code=404, detail="Manifeste sans patch scorable")

    def _promote_artifact(self, artifact: Path, public_key_hex: str = "") -> None:
        """Stage patch on disk at canary 0% until Operations approves a percentage."""
        raw = json.loads(artifact.read_text(encoding="utf-8"))
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        version = f"ml-{raw.get('model_version', 1)}-{digest[:12]}"
        wrapper = {
            "version": version,
            "artifact_sha256": digest,
            "public_key_hex": public_key_hex,
            "patch": raw,
            # 0% until admin Approuver in Opérations (phones use hash % 100 < pct).
            "rollout": {"stage": "canary", "percentage": 0},
        }
        target = Path(get_settings().model_patch_manifest_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(wrapper, ensure_ascii=False, indent=2), encoding="utf-8")

        deployment = self.db.scalar(
            select(PatchDeployment).where(PatchDeployment.version == version)
        )
        if deployment is None:
            deployment = PatchDeployment(
                version=version,
                status="CANARY",
                rollout_percentage=0,
            )
            self.db.add(deployment)
        else:
            deployment.status = "CANARY"
            deployment.rollout_percentage = 0
            deployment.approved_by = None
            deployment.approved_at = None
        self.db.flush()

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
