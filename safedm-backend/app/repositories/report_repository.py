from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CommunityReport
from app.models.enums import ReportSource, ReportStatus


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, report_id: int) -> CommunityReport | None:
        return self.db.get(CommunityReport, report_id)

    def get_by_user_threat(self, user_id: int, threat_id: int) -> CommunityReport | None:
        return self.db.scalar(
            select(CommunityReport).where(
                CommunityReport.user_id == user_id,
                CommunityReport.threat_id == threat_id,
            )
        )

    def create(
        self,
        *,
        user_id: int,
        threat_id: int,
        source: ReportSource,
    ) -> CommunityReport:
        report = CommunityReport(
            user_id=user_id,
            threat_id=threat_id,
            source=source,
            status=ReportStatus.ACTIVE,
        )
        self.db.add(report)
        self.db.flush()
        return report

    def withdraw(self, report: CommunityReport) -> CommunityReport:
        report.status = ReportStatus.WITHDRAWN
        report.withdrawn_at = datetime.now(timezone.utc)
        self.db.add(report)
        self.db.flush()
        return report

    def reactivate(self, report: CommunityReport, source: ReportSource) -> CommunityReport:
        report.status = ReportStatus.ACTIVE
        report.source = source
        report.withdrawn_at = None
        self.db.add(report)
        self.db.flush()
        return report
