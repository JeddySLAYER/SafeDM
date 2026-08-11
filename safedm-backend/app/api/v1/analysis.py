from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    UrlGateRequest,
    UrlGateResponse,
)
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
def analyze_message(
    payload: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse un message. Le contenu n'est pas stocké côté serveur."""
    _ = current_user  # auth required
    return AnalysisService(db).analyze(payload)


@router.post("/link", response_model=UrlGateResponse)
@router.post("/url", response_model=UrlGateResponse)
def analyze_url(
    payload: UrlGateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse un lien avant ouverture (Link Gate). Journal léger côté ops."""
    return AnalysisService(db).analyze_url(payload, user_id=current_user.id)
