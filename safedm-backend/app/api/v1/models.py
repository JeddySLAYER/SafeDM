import hashlib
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.models.admin_operations import ModelDeviceReceipt, PatchDeployment
from app.schemas.ml_ops import ModelReceiptRequest

router = APIRouter(prefix="/models", tags=["models"])


@router.post("/ack", status_code=204)
def acknowledge_model_patch(
    payload: ModelReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path = Path(get_settings().model_patch_manifest_path)
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=404, detail="Aucun patch actif") from exc
    if loaded.get("version") != payload.version:
        raise HTTPException(status_code=409, detail="La version reçue n’est plus le manifeste actif")

    device_hash = hashlib.sha256(payload.device_identifier.encode("utf-8")).hexdigest()
    receipt = db.scalar(
        select(ModelDeviceReceipt).where(
            ModelDeviceReceipt.version == payload.version,
            ModelDeviceReceipt.user_id == current_user.id,
            ModelDeviceReceipt.device_hash == device_hash,
        )
    )
    if receipt is None:
        receipt = ModelDeviceReceipt(
            version=payload.version,
            user_id=current_user.id,
            device_hash=device_hash,
            app_version=payload.app_version,
            status="applied",
        )
    else:
        receipt.app_version = payload.app_version
        receipt.status = "applied"
    db.add(receipt)
    db.commit()
    return


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
            raise TypeError("invalid manifest")
        patch = loaded.get("patch") if isinstance(loaded.get("patch"), dict) else loaded
        if not isinstance(patch.get("quantization"), dict) or not patch["quantization"].get("weights"):
            raise HTTPException(status_code=404, detail="No deployable model patch available")
        version = loaded.get("version") or (
            f"ml-{patch.get('model_version', 1)}" if patch.get("quantization") else None
        )
        if not version:
            raise ValueError("invalid manifest")
        # Le mobile refuse un manifeste sans cle publique : il ne peut pas
        # verifier la signature. On le dit explicitement plutot que de servir
        # un manifeste que tous les telephones ignoreront silencieusement.
        public_key_hex = loaded.get("public_key_hex") or patch.get("public_key_hex")
        if not public_key_hex:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Manifeste sans cle publique : republiez-le avec "
                    "scripts/publish_model_manifest.py pour que le mobile puisse "
                    "verifier la signature."
                ),
            )
        manifest = {
            "version": version,
            "artifact_sha256": loaded.get("artifact_sha256"),
            "public_key_hex": public_key_hex,
            "patch": patch if patch.get("quantization") else None,
            "rollout": loaded.get("rollout") or {"stage": "canary", "percentage": patch.get("canary_percent", 0)},
        }
        deployment = db.scalar(
            select(PatchDeployment).where(PatchDeployment.version == version)
        )
        if deployment and deployment.status == "ROLLED_BACK":
            raise HTTPException(status_code=404, detail="Model manifest rolled back")
        if deployment and deployment.status == "APPROVED":
            percentage = float(deployment.rollout_percentage)
            stage = "production" if percentage >= 100 else "canary"
            manifest["rollout"] = {"percentage": percentage, "stage": stage}
        elif deployment:
            # Staged (CANARY) but not approved yet — no device should pull.
            manifest["rollout"] = {"percentage": 0, "stage": "canary"}
        else:
            # File-only fallback: honour manifest rollout (never invent production 100%).
            file_rollout = manifest.get("rollout") or {}
            manifest["rollout"] = {
                "stage": file_rollout.get("stage") or "canary",
                "percentage": float(file_rollout.get("percentage") or 0),
            }
        return JSONResponse(
            content=manifest,
            headers={"Cache-Control": "no-store"},
        )
    except (FileNotFoundError, json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=404, detail="No model manifest available") from exc
