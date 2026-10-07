from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import SessionLocal

router = APIRouter()


@router.get("/health")
def health_check():
    """Liveness — process up (no dependency checks)."""
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
    }


@router.get("/health/ready")
def readiness_check(response: Response):
    """Readiness — PostgreSQL reachable."""
    settings = get_settings()
    db_ok = False
    error = None
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:  # noqa: BLE001 — surface as readiness failure
        error = type(exc).__name__

    payload = {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "env": settings.app_env,
        "checks": {"database": "ok" if db_ok else "fail"},
    }
    if error:
        payload["error"] = error
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return payload
