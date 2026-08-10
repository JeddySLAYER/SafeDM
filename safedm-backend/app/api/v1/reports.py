from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas.report import (
    ReportCreateRequest,
    ReportCreateResponse,
    ReportResponse,
    UserReportListResponse,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=UserReportListResponse)
def list_my_reports(
    active_only: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ReportService(db).list_mine(current_user, active_only=active_only)


@router.post("", response_model=ReportCreateResponse, status_code=201)
def create_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Signale un message — le contenu est alors conservé côté serveur."""
    return ReportService(db).create(current_user, payload)


@router.delete("/{report_id}", response_model=ReportResponse)
def withdraw_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ReportService(db).withdraw(current_user, report_id)
