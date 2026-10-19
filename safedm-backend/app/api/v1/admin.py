import hashlib
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models import User
from app.models.enums import ReportStatus, ThreatStatus
from app.models.ml_ops import MlDataset, MlModelArtifact
from app.schemas.admin import (
    AdminAggregationRunResponse,
    AdminFalsePositiveRequest,
    AdminPatchActionRequest,
    AdminReportItem,
    AdminReportLabelRequest,
    AdminReportListResponse,
    AdminReportsDatasetRequest,
    AdminStatsResponse,
    AdminTenantPolicyRequest,
    AdminTenantPolicyResponse,
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
from app.schemas.ml_ops import (
    MlArtifactReviewRequest,
    MlDatasetCreateRequest,
    MlReviewQueueDatasetRequest,
    MlTfliteEvaluateRequest,
    MlTrainStartRequest,
    MlTryMessageRequest,
)
from app.schemas.monitoring import ApplicationResponse
from app.schemas.report import ReportResponse, ThreatResponse
from app.services.admin_service import AdminService
from app.services.audit_service import record_access
from app.services.guide_service import GuideService
from app.services.ml_ops_service import MlOpsService
from ml.evaluation.tflite_diagnostics import evaluate_tflite_dataset

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
    result = AdminService(db).approve_patch(
        payload.version, current_admin, payload.rollout_percentage
    )
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


@router.get("/reports/{report_id}", response_model=AdminReportItem)
def admin_get_report(
    report_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    record_access(
        db,
        user_id=current_admin.id,
        action="admin_report_content_view",
        resource=str(report_id),
        purpose="Review community report content",
    )
    result = AdminService(db).get_report_detail(report_id)
    db.commit()
    return result


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


@router.get("/ml/datasets/{dataset_id}/cases")
def admin_get_dataset_cases(
    dataset_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dataset = db.get(MlDataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset introuvable")
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_cases_view",
        resource=str(dataset_id),
        purpose="Mobile local model diagnostic input",
    )
    db.commit()
    return {"dataset_id": dataset.id, "items": json.loads(dataset.content_json)}


@router.delete("/ml/datasets/{dataset_id}")
def admin_delete_ml_dataset(
    dataset_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = MlOpsService(db)
    files = service.delete_dataset(dataset_id)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_delete",
        resource=str(dataset_id),
        purpose="Delete dataset, its runs and local training artifacts",
    )
    db.commit()
    service.remove_training_files(files)
    return {"ok": True, "deleted_dataset_id": dataset_id, "deleted_artifact_count": len(files)}


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


@router.post("/ml/datasets/from-reports", status_code=status.HTTP_201_CREATED)
def admin_create_dataset_from_reports(
    payload: AdminReportsDatasetRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).create_dataset_from_reports(
        name=payload.name,
        items=[item.model_dump() for item in payload.items],
        admin=current_admin,
    )
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_from_reports",
        resource=str(result["id"]),
        purpose="Create human-reviewed training dataset from reports",
    )
    db.commit()
    return result


@router.get("/ml/report-review-queue")
def admin_list_report_review_queue(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    items = MlOpsService(db).list_report_training_queue()
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_report_queue_view",
        resource="review-queue",
        purpose="Review queued report labels and previews",
    )
    db.commit()
    return {"items": items}


@router.put("/ml/report-review-queue/{report_id}")
def admin_queue_report_for_training(
    report_id: int,
    payload: AdminReportLabelRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).queue_report_for_training(
        report_id=report_id,
        expected=payload.expected,
        admin=current_admin,
    )
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_report_label",
        resource=str(report_id),
        purpose=f"Label report as {result['expected']} for training review",
    )
    db.commit()
    return result


@router.delete("/ml/report-review-queue/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_remove_report_from_training_queue(
    report_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    MlOpsService(db).remove_report_from_training_queue(report_id)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_report_unqueue",
        resource=str(report_id),
        purpose="Remove report from training review queue",
    )
    db.commit()
    return None


@router.post("/ml/datasets/from-review-queue", status_code=status.HTTP_201_CREATED)
def admin_create_dataset_from_review_queue(
    payload: MlReviewQueueDatasetRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).create_dataset_from_review_queue(name=payload.name, admin=current_admin)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_dataset_from_review_queue",
        resource=str(result["id"]),
        purpose="Create training dataset from persisted human-reviewed reports",
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


@router.delete("/ml/runs/{run_id}")
def admin_delete_ml_run(
    run_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    service = MlOpsService(db)
    files = service.delete_run(run_id)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_train_run_delete",
        resource=str(run_id),
        purpose="Delete training run and local artifacts",
    )
    db.commit()
    service.remove_training_files(files)
    return {"ok": True, "deleted_run_id": run_id, "deleted_artifact_count": len(files)}


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


@router.post("/ml/try")
def admin_try_ml_message(
    payload: MlTryMessageRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).try_message(payload.message, run_id=payload.run_id)
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_try_message",
        resource=str(payload.run_id) if payload.run_id is not None else "manifest",
        purpose="Admin local patch score",
    )
    db.commit()
    return result


@router.post("/ml/evaluate-tflite")
def admin_evaluate_tflite(
    payload: MlTfliteEvaluateRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = evaluate_tflite_dataset(
        db,
        dataset_id=payload.dataset_id,
        run_id=payload.run_id,
        mobile_features=payload.mobile_features,
        mobile_results=payload.mobile_results,
        mobile_messages=payload.mobile_messages,
    )
    record_access(
        db,
        user_id=current_admin.id,
        action="ml_evaluate_tflite",
        resource=f"dataset:{payload.dataset_id}",
        purpose="Local TFLite and integer patch diagnostic",
    )
    db.commit()
    return result


@router.post("/ml/evaluate-tflite-upload")
def admin_evaluate_uploaded_tflite(
    model_file: UploadFile = File(...),
    payload: str = Form(...),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Persist and evaluate an admin-supplied TFLite model."""
    temp_path = None
    stored_path = None
    try:
        try:
            evaluation = MlTfliteEvaluateRequest.model_validate_json(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail="Paramètres du diagnostic invalides") from exc

        filename = (model_file.filename or "model.tflite").replace("\\", "/").rsplit("/", 1)[-1]
        if Path(filename).suffix.lower() != ".tflite":
            raise HTTPException(status_code=422, detail="Le fichier doit avoir l’extension .tflite")
        max_bytes = 25 * 1024 * 1024
        data = model_file.file.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise HTTPException(status_code=413, detail="Le modèle dépasse la limite de 25 Mio")
        if len(data) < 8 or data[4:8] != b"TFL3":
            raise HTTPException(status_code=422, detail="Fichier invalide : signature FlatBuffer TFL3 absente")

        digest = hashlib.sha256(data).hexdigest()
        with tempfile.NamedTemporaryFile(prefix="safedm-tflite-", suffix=".tflite", delete=False) as temp_file:
            temp_file.write(data)
            temp_path = Path(temp_file.name)
        result = evaluate_tflite_dataset(
            db,
            dataset_id=evaluation.dataset_id,
            run_id=evaluation.run_id,
            mobile_features=evaluation.mobile_features,
            mobile_results=evaluation.mobile_results,
            mobile_messages=evaluation.mobile_messages,
            model_path_override=temp_path,
            model_source="uploaded",
            model_filename=filename,
            model_sha256=digest,
        )
        dataset_dir = Path(get_settings().model_patch_manifest_path).resolve().parent / "tflite_artifacts"
        dataset_dir.mkdir(parents=True, exist_ok=True)
        stored_path = dataset_dir / f"{digest}.tflite"
        stored_path.write_bytes(data)
        artifact = MlModelArtifact(
            dataset_id=evaluation.dataset_id,
            run_id=evaluation.run_id,
            filename=filename,
            storage_path=str(stored_path),
            sha256=digest,
            size_bytes=len(data),
            status="evaluated",
            evaluation_json=json.dumps(result, ensure_ascii=False),
            created_by_user_id=current_admin.id,
            evaluated_at=datetime.now(UTC),
        )
        db.add(artifact)
        db.flush()
        result["artifact"] = MlOpsService._artifact_public(artifact, full=False)
        record_access(
            db,
            user_id=current_admin.id,
            action="ml_evaluate_tflite_upload",
            resource=f"dataset:{evaluation.dataset_id}",
            purpose="Evaluate temporary uploaded TFLite model",
        )
        db.commit()
        return result
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        model_file.file.close()


@router.get("/ml/artifacts")
def admin_list_tflite_artifacts(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return {"items": MlOpsService(db).list_artifacts()}


@router.get("/ml/evaluations")
def admin_list_tflite_evaluations(
    artifact_id: int | None = Query(default=None, ge=1),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    query = db.query(MlModelArtifact).filter(MlModelArtifact.evaluation_json.is_not(None))
    if artifact_id is not None:
        query = query.filter(MlModelArtifact.id == artifact_id)
    return {
        "items": [
            {
                "artifact_id": artifact.id,
                "dataset_id": artifact.dataset_id,
                "run_id": artifact.run_id,
                "evaluated_at": artifact.evaluated_at.isoformat() if artifact.evaluated_at else None,
                "metrics": json.loads(artifact.evaluation_json).get("metrics", {}),
            }
            for artifact in query.order_by(MlModelArtifact.id.desc()).limit(100).all()
        ]
    }


@router.get("/ml/metrics")
def admin_get_tflite_metrics(
    artifact_id: int = Query(..., ge=1),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    artifact = db.get(MlModelArtifact, artifact_id)
    if artifact is None or not artifact.evaluation_json:
        raise HTTPException(status_code=404, detail="Évaluation TFLite introuvable")
    evaluation = json.loads(artifact.evaluation_json)
    return {"artifact_id": artifact.id, "metrics": evaluation.get("metrics", {}), "tflite": evaluation.get("tflite", {})}


@router.get("/ml/artifacts/{artifact_id}")
def admin_get_tflite_artifact(
    artifact_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    _ = current_admin
    return MlOpsService(db).get_artifact(artifact_id)


@router.post("/ml/artifacts/{artifact_id}/evaluate")
def admin_evaluate_tflite_artifact(
    artifact_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    artifact = db.get(MlModelArtifact, artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artefact TFLite introuvable")
    result = evaluate_tflite_dataset(
        db,
        dataset_id=artifact.dataset_id,
        run_id=artifact.run_id,
        model_path_override=Path(artifact.storage_path),
        model_source="stored",
        model_filename=artifact.filename,
        model_sha256=artifact.sha256,
    )
    artifact.evaluation_json = json.dumps(result, ensure_ascii=False)
    artifact.status = "evaluated"
    artifact.evaluated_at = datetime.now(UTC)
    record_access(db, user_id=current_admin.id, action="ml_evaluate_tflite_artifact", resource=str(artifact_id), purpose="Re-evaluate persisted TFLite artifact")
    db.commit()
    return result


@router.put("/ml/artifacts/{artifact_id}/review")
def admin_review_tflite_artifact(
    artifact_id: int,
    payload: MlArtifactReviewRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).review_artifact(
        artifact_id,
        status_value=payload.status,
        note=payload.note,
        admin=current_admin,
    )
    record_access(db, user_id=current_admin.id, action="ml_review_tflite_artifact", resource=str(artifact_id), purpose=f"TFLite artifact review: {payload.status}")
    db.commit()
    return result


@router.put("/ml/runs/{run_id}/review")
def admin_review_train_run(
    run_id: int,
    payload: MlArtifactReviewRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = MlOpsService(db).review_run(
        run_id,
        status_value=payload.status,
        note=payload.note,
        admin=current_admin,
    )
    record_access(db, user_id=current_admin.id, action="ml_review_train_run", resource=str(run_id), purpose=f"ML run review: {payload.status}")
    db.commit()
    return result
