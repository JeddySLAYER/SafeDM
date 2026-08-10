from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models import User
from app.models.enums import ThreatStatus
from app.schemas.admin import (
    AdminStatsResponse,
    AdminThreatListResponse,
    AdminUserListResponse,
    ThreatStatusUpdateRequest,
)
from app.schemas.guide import (
    GuideArticleCreateRequest,
    GuideArticleResponse,
    GuideArticleUpdateRequest,
    GuideCategoryCreateRequest,
    GuideCategoryResponse,
    GuideCategoryUpdateRequest,
)
from app.schemas.report import ThreatResponse
from app.services.admin_service import AdminService
from app.services.guide_service import GuideService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).stats()


@router.get("/users", response_model=AdminUserListResponse)
def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_users(page=page, page_size=page_size)


@router.get("/guide/categories", response_model=list[GuideCategoryResponse])
def admin_list_guide_categories(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).list_categories(published_only=False)


@router.get("/threats", response_model=AdminThreatListResponse)
def admin_list_threats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: ThreatStatus | None = Query(default=None, alias="status"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_threats(page=page, page_size=page_size, status=status_filter)


@router.put("/threats/{threat_id}/status", response_model=ThreatResponse)
def admin_update_threat_status(
    threat_id: int,
    payload: ThreatStatusUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).update_threat_status(threat_id, payload.status)


@router.post(
    "/guide/categories",
    response_model=GuideCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_category(
    payload: GuideCategoryCreateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).create_category(payload)


@router.put("/guide/categories/{category_id}", response_model=GuideCategoryResponse)
def admin_update_category(
    category_id: int,
    payload: GuideCategoryUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).update_category(category_id, payload)


@router.delete("/guide/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_category(
    category_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    GuideService(db).delete_category(category_id)
    return None


@router.post(
    "/guide/articles",
    response_model=GuideArticleResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_article(
    payload: GuideArticleCreateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).create_article(payload)


@router.put("/guide/articles/{article_id}", response_model=GuideArticleResponse)
def admin_update_article(
    article_id: int,
    payload: GuideArticleUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).update_article(article_id, payload)


@router.delete("/guide/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_article(
    article_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    GuideService(db).delete_article(article_id)
    return None
