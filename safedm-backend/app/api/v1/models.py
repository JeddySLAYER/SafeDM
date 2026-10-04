import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/latest")
def latest_model_manifest(current_user: User = Depends(get_current_user)):
    _ = current_user
    path = Path(get_settings().model_patch_manifest_path)
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or not manifest.get("version"):
            raise ValueError("invalid manifest")
        return JSONResponse(
            content=manifest,
            headers={"Cache-Control": "no-store"},
        )
    except (FileNotFoundError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="No model manifest available") from exc
