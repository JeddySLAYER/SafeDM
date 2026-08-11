from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

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

    def list_for_user(
        self,
        user_id: int,
        *,
        active_only: bool = True,
    ) -> list[CommunityReport]:
        stmt = (
            select(CommunityReport)
            .options(joinedload(CommunityReport.threat))
            .where(CommunityReport.user_id == user_id)
            .order_by(CommunityReport.created_at.desc())
        )
        if active_only:
            stmt = stmt.where(CommunityReport.status == ReportStatus.ACTIVE)
        return list(self.db.scalars(stmt).unique().all())

    def count_for_user(self, user_id: int, *, active_only: bool = True) -> int:
        stmt = select(func.count(CommunityReport.id)).where(CommunityReport.user_id == user_id)
        if active_only:
            stmt = stmt.where(CommunityReport.status == ReportStatus.ACTIVE)
        return int(self.db.scalar(stmt) or 0)

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

    def list_all(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: ReportStatus | None = None,
    ) -> tuple[list[CommunityReport], int]:
        page = max(1, page)
        page_size = min(100, max(1, page_size))

        count_stmt = select(func.count(CommunityReport.id))
        stmt = (
            select(CommunityReport)
            .options(
                joinedload(CommunityReport.threat),
                joinedload(CommunityReport.user),
            )
            .order_by(CommunityReport.created_at.desc())
        )
        if status is not None:
            count_stmt = count_stmt.where(CommunityReport.status == status)
            stmt = stmt.where(CommunityReport.status == status)

        total = int(self.db.scalar(count_stmt) or 0)
        items = list(
            self.db.scalars(
                stmt.offset((page - 1) * page_size).limit(page_size)
            )
            .unique()
            .all()
        )
        return items, total
