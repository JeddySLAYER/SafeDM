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
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or not manifest.get("version"):
            raise ValueError("invalid manifest")
        deployment = db.scalar(
            select(PatchDeployment).where(
                PatchDeployment.version == manifest["version"]
            )
        )
        if deployment and deployment.status == "ROLLED_BACK":
            raise HTTPException(status_code=404, detail="Model manifest rolled back")
        if deployment:
            manifest = {
                **manifest,
                "rollout": {
                    **(manifest.get("rollout") or {}),
                    "percentage": deployment.rollout_percentage,
                    "stage": (
                        "production"
                        if deployment.status == "APPROVED"
                        else (manifest.get("rollout") or {}).get("stage", "canary")
                    ),
                },
            }
        return JSONResponse(
            content=manifest,
            headers={"Cache-Control": "no-store"},
        )
    except (FileNotFoundError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="No model manifest available") from exc
