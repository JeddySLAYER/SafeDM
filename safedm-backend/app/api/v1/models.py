import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.models import User
from app.models.admin_operations import PatchDeployment
from app.core.database import get_db

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/latest")
def latest_model_manifest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    path = Path(get_settings().model_patch_manifest_path)
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict):
            raise ValueError("invalid manifest")
        patch = loaded.get("patch") if isinstance(loaded.get("patch"), dict) else loaded
        version = loaded.get("version") or (
            f"ml-{patch.get('model_version', 1)}" if patch.get("quantization") else None
        )
        if not version:
            raise ValueError("invalid manifest")
        manifest = {
            "version": version,
            "artifact_sha256": loaded.get("artifact_sha256"),
            "public_key_hex": loaded.get("public_key_hex"),
            "patch": patch if patch.get("quantization") else None,
            "rollout": loaded.get("rollout") or {"stage": "canary", "percentage": patch.get("canary_percent", 0)},
        }
        deployment = db.scalar(
            select(PatchDeployment).where(PatchDeployment.version == version)
        )
        if deployment and deployment.status == "ROLLED_BACK":
            raise HTTPException(status_code=404, detail="Model manifest rolled back")
        if deployment:
            percentage = float(deployment.rollout_percentage)
            stage = "canary"
            if deployment.status == "APPROVED":
                stage = "production" if percentage >= 100 else "canary"
            manifest["rollout"] = {"percentage": percentage, "stage": stage}
        elif not deployment:
            manifest["rollout"] = {
                "stage": "production",
                "percentage": float((manifest.get("rollout") or {}).get("percentage") or 100),
            }
        return JSONResponse(
            content=manifest,
            headers={"Cache-Control": "no-store"},
        )
    except (FileNotFoundError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="No model manifest available") from exc
