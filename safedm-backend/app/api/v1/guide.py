from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.guide import GuideArticleResponse, GuideCategoryResponse
from app.services.guide_service import GuideService

router = APIRouter(prefix="/guide", tags=["guide"])


@router.get("/categories", response_model=list[GuideCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return GuideService(db).list_categories(published_only=True)


@router.get("/articles/{article_id}", response_model=GuideArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    return GuideService(db).get_article(article_id, published_only=True)
