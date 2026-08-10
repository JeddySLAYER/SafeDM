from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.models.enums import ReportStatus
from app.repositories.report_repository import ReportRepository
from app.repositories.threat_repository import ThreatRepository
from app.schemas.report import (
    ReportCreateRequest,
    ReportCreateResponse,
    ReportResponse,
)


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.reports = ReportRepository(db)
        self.threats = ThreatRepository(db)

    def create(self, user: User, payload: ReportCreateRequest) -> ReportCreateResponse:
        content = payload.content.strip()
        threat, created_threat = self.threats.get_or_create_from_content(
            content=content,
            severity=payload.severity,
        )

        existing = self.reports.get_by_user_threat(user.id, threat.id)
        if existing and existing.status == ReportStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vous avez déjà signalé cette menace",
            )

        if existing and existing.status == ReportStatus.WITHDRAWN:
            report = self.reports.reactivate(existing, payload.source)
        else:
            report = self.reports.create(
                user_id=user.id,
                threat_id=threat.id,
                source=payload.source,
            )

        self.threats.recount_active_reports(threat)
        self.db.commit()
        self.db.refresh(report)
        self.db.refresh(threat)

        return ReportCreateResponse(
            report=ReportResponse.model_validate(report),
            threat_id=threat.id,
            created_threat=created_threat,
            content_stored=True,
        )

    def withdraw(self, user: User, report_id: int) -> ReportResponse:
        report = self.reports.get_by_id(report_id)
        if report is None or report.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signalement introuvable")
        if report.status == ReportStatus.WITHDRAWN:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signalement déjà retiré")

        self.reports.withdraw(report)
        threat = self.threats.get_by_id(report.threat_id)
        if threat:
            self.threats.recount_active_reports(threat)
        self.db.commit()
        self.db.refresh(report)
        return ReportResponse.model_validate(report)
