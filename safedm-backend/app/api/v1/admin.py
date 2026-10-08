from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models import User
from app.models.enums import ReportStatus, ThreatStatus
from app.schemas.admin import (
    AdminReportListResponse,
    AdminAggregationRunResponse,
    AdminFalsePositiveRequest,
    AdminPatchActionRequest,
    AdminTenantPolicyRequest,
    AdminTenantPolicyResponse,
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
from app.schemas.ml_ops import MlDatasetCreateRequest, MlTrainStartRequest
from app.services.admin_service import AdminService
from app.services.audit_service import record_access
from app.services.guide_service import GuideService
from app.services.ml_ops_service import MlOpsService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).stats()


@router.get("/operations/overview")
def admin_operations_overview(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return AdminService(db).operations_overview()


@router.post("/operations/patches/approve")
def admin_approve_patch(
    payload: AdminPatchActionRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = AdminService(db).approve_patch(payload.version, current_admin)
    record_access(db, user_id=current_admin.id, action="approve_patch", resource=payload.version, purpose="Admin deployment approval")
    db.commit()
    return result


@router.post("/operations/patches/rollback")
def admin_rollback_patch(
    payload: AdminPatchActionRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = AdminService(db).rollback_patch(payload.version, current_admin)
    record_access(db, user_id=current_admin.id, action="rollback_patch", resource=payload.version, purpose="Admin deployment rollback")
    db.commit()
    return result


@router.post("/operations/aggregation", response_model=AdminAggregationRunResponse)
def admin_request_aggregation(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = AdminService(db).request_aggregation(current_admin)
    record_access(db, user_id=current_admin.id, action="request_aggregation", resource="weekly_patch", purpose="Manual aggregation request")
    db.commit()
    return result


@router.put("/operations/policies", response_model=AdminTenantPolicyResponse)
def admin_save_policy(
    payload: AdminTenantPolicyRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = AdminService(db).save_tenant_policy(payload, current_admin)
    record_access(db, user_id=current_admin.id, action="update_policy", resource=payload.tenant_key, purpose="Tenant threshold configuration")
    db.commit()
    return result


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


@router.put("/threats/{threat_id}/false-positive", response_model=ThreatResponse)
def admin_flag_false_positive(
    threat_id: int,
    payload: AdminFalsePositiveRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    result = AdminService(db).flag_false_positive(threat_id, payload.value)
    record_access(db, user_id=current_admin.id, action="flag_false_positive", resource=str(threat_id), purpose="Manual threat moderation")
    db.commit()
    return result


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


# --- ML training ops (datasets + runs + promote canary) ---


@router.get("/ml/datasets")
def admin_list_datasets(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return {"items": MlOpsService(db).list_datasets()}


@router.get("/ml/datasets/{dataset_id}")
def admin_get_dataset(
    dataset_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return MlOpsService(db).get_dataset(dataset_id)


@router.post("/ml/datasets", status_code=status.HTTP_201_CREATED)
def admin_create_dataset(
    payload: MlDatasetCreateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).create_dataset(
        name=payload.name,
        content=payload.content,
        source=payload.source,
        admin=current_admin,
    )
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_upload",
        resource=str(result["id"]),
        purpose="Admin ML dataset ingest",
    )
    db.commit()
    return result


@router.post("/ml/datasets/seed-builtin", status_code=status.HTTP_201_CREATED)
def admin_seed_builtin_dataset(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).seed_builtin(current_admin)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_seed",
        resource=str(result["id"]),
        purpose="Admin ML builtin seed",
    )
    db.commit()
    return result


@router.get("/ml/runs")
def admin_list_train_runs(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return {"items": MlOpsService(db).list_runs()}


@router.get("/ml/runs/{run_id}")
def admin_get_train_run(
    run_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return MlOpsService(db).get_run(run_id)


@router.post("/ml/runs", status_code=status.HTTP_201_CREATED)
def admin_start_train_run(
    payload: MlTrainStartRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).start_train(
        dataset_id=payload.dataset_id,
        admin=current_admin,
        promote_canary=payload.promote_canary,
    )
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_train_run",
        resource=str(result["id"]),
        purpose="Admin ML train job",
    )
    db.commit()
    return result


@router.post("/ml/runs/{run_id}/promote")
def admin_promote_train_run(
    run_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).promote_run(run_id)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_promote_canary",
        resource=str(run_id),
        purpose="Promote trained patch to canary manifest",
    )
    db.commit()
    return result
