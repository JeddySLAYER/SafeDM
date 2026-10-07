from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import check_rate_limit
from app.models import User
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    FeatureVectorAnalysisRequest,
    UrlGateRequest,
    UrlGateResponse,
)
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
def analyze_message(
    payload: AnalysisRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse un message. Le contenu n'est pas stocké côté serveur."""
    _ = current_user  # auth required
    if get_settings().rate_limit_enabled:
        check_rate_limit(request, "/analysis")
    return AnalysisService(db).analyze(payload)


@router.post("/features", response_model=AnalysisResponse)
def analyze_features(
    payload: FeatureVectorAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse uniquement le vecteur local, sans recevoir le texte."""
    _ = current_user
    if not payload.consent_external:
        raise HTTPException(status_code=400, detail="Explicit consent is required")
    return AnalysisService(db).analyze_encrypted_features(payload)


@router.post("/link", response_model=UrlGateResponse)
@router.post("/url", response_model=UrlGateResponse)
def analyze_url(
    payload: UrlGateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse un lien avant ouverture (Link Gate). Journal léger côté ops."""
    return AnalysisService(db).analyze_url(payload, user_id=current_user.id)
