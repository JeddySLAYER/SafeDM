from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models import User
from app.models.enums import ReportStatus, ThreatStatus
from app.schemas.admin import (
    AdminReportListResponse,
    AdminStatsResponse,
    AdminThreatDetailResponse,
    AdminThreatListResponse,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    LinkGateEventListResponse,
    ThreatSeverityUpdateRequest,
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
from app.schemas.monitoring import ApplicationResponse
from app.schemas.report import ReportResponse, ThreatResponse
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


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def admin_get_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).get_user_detail(user_id)


@router.put("/users/{user_id}", response_model=AdminUserDetailResponse)
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return AdminService(db).update_user(
        user_id, is_admin=payload.is_admin, actor=current_admin
    )


@router.get("/applications", response_model=list[ApplicationResponse])
def admin_list_applications(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_applications()


@router.post(
    "/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_application(
    payload: ApplicationCreateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).create_application(payload)


@router.put("/applications/{application_id}", response_model=ApplicationResponse)
def admin_update_application(
    application_id: int,
    payload: ApplicationUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).update_application(application_id, payload)


@router.delete(
    "/applications/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_application(
    application_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    AdminService(db).delete_application(application_id)
    return None


@router.get("/link-gate", response_model=LinkGateEventListResponse)
def admin_list_link_gate(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    decision: str | None = Query(default=None),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_link_gate_events(
        page=page, page_size=page_size, decision=decision
    )


@router.get("/reports", response_model=AdminReportListResponse)
def admin_list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_reports(
        page=page, page_size=page_size, status=status_filter
    )


@router.delete("/reports/{report_id}", response_model=ReportResponse)
def admin_withdraw_report(
    report_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).withdraw_report(report_id)


@router.get("/guide/categories", response_model=list[GuideCategoryResponse])
def admin_list_guide_categories(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).list_categories(published_only=False)


@router.get("/guide/articles/{article_id}", response_model=GuideArticleResponse)
def admin_get_article(
    article_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return GuideService(db).get_article(article_id, published_only=False)


@router.get("/threats", response_model=AdminThreatListResponse)
def admin_list_threats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: ThreatStatus | None = Query(default=None, alias="status"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).list_threats(
        page=page, page_size=page_size, status=status_filter
    )


@router.get("/threats/{threat_id}", response_model=AdminThreatDetailResponse)
def admin_get_threat(
    threat_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).get_threat_detail(threat_id)


@router.put("/threats/{threat_id}/status", response_model=ThreatResponse)
def admin_update_threat_status(
    threat_id: int,
    payload: ThreatStatusUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).update_threat_status(threat_id, payload.status)


@router.put("/threats/{threat_id}/severity", response_model=ThreatResponse)
def admin_update_threat_severity(
    threat_id: int,
    payload: ThreatSeverityUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).update_threat_severity(threat_id, payload.severity)


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
