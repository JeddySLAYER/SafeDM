from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze_message(
    payload: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyse un message. Le contenu n'est pas stocké côté serveur."""
    _ = current_user  # auth required
    return AnalysisService(db).analyze(payload)
