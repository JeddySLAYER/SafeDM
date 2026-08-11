from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import cast, Date, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CommunityReport, SupportedApplication, Threat, User
from app.models.enums import ReportStatus, ThreatSeverity, ThreatStatus
from app.repositories.guide_repository import GuideRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.threat_repository import ThreatRepository
from app.schemas.admin import (
    AdminReportItem,
    AdminReportListResponse,
    AdminStatsResponse,
    AdminThreatListResponse,
    AdminUserItem,
    AdminUserListResponse,
    DayCount,
    ProviderHealth,
    SeverityBucket,
    TopThreatItem,
)
from app.schemas.report import ReportResponse, ThreatResponse, ThreatUrlResponse


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.guide = GuideRepository(db)
        self.threats = ThreatRepository(db)
        self.reports = ReportRepository(db)

    def stats(self) -> AdminStatsResponse:
        settings = get_settings()
        users_count = int(self.db.scalar(select(func.count(User.id))) or 0)
        reports_active = int(
            self.db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.status == ReportStatus.ACTIVE
                )
            )
            or 0
        )
        reports_withdrawn = int(
            self.db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.status == ReportStatus.WITHDRAWN
                )
            )
            or 0
        )
        threats_active = int(
            self.db.scalar(
                select(func.count(Threat.id)).where(Threat.status == ThreatStatus.ACTIVE)
            )
            or 0
        )
        threats_dismissed = int(
            self.db.scalar(
                select(func.count(Threat.id)).where(Threat.status == ThreatStatus.DISMISSED)
            )
            or 0
        )
        threats_under_review = int(
            self.db.scalar(
                select(func.count(Threat.id)).where(
                    Threat.status == ThreatStatus.UNDER_REVIEW
                )
            )
            or 0
        )
        apps = int(self.db.scalar(select(func.count(SupportedApplication.id))) or 0)

        severity_rows = self.db.execute(
            select(Threat.severity, func.count(Threat.id))
            .where(Threat.status == ThreatStatus.ACTIVE)
            .group_by(Threat.severity)
        ).all()
        severity_distribution = [
            SeverityBucket(severity=sev, count=int(cnt)) for sev, cnt in severity_rows
        ]

        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=6)
        report_day_rows = {
            str(day): int(cnt)
            for day, cnt in self.db.execute(
                select(cast(CommunityReport.created_at, Date), func.count(CommunityReport.id))
                .where(cast(CommunityReport.created_at, Date) >= start)
                .group_by(cast(CommunityReport.created_at, Date))
            ).all()
        }
        threat_day_rows = {
            str(day): int(cnt)
            for day, cnt in self.db.execute(
                select(cast(Threat.first_seen_at, Date), func.count(Threat.id))
                .where(cast(Threat.first_seen_at, Date) >= start)
                .group_by(cast(Threat.first_seen_at, Date))
            ).all()
        }
        reports_last_7_days = []
        for i in range(7):
            day = start + timedelta(days=i)
            key = str(day)
            reports_last_7_days.append(
                DayCount(
                    day=key,
                    reports=report_day_rows.get(key, 0),
                    threats=threat_day_rows.get(key, 0),
                )
            )

        top_rows = list(
            self.db.scalars(
                select(Threat)
                .where(Threat.status == ThreatStatus.ACTIVE)
                .order_by(Threat.report_count.desc(), Threat.last_seen_at.desc())
                .limit(8)
            ).all()
        )
        top_reported = [
            TopThreatItem(
                id=t.id,
                preview=(t.content or "")[:120],
                report_count=t.report_count,
                severity=t.severity,
                status=t.status,
            )
            for t in top_rows
        ]

        gemini_configured = bool(settings.gemini_api_key)
        vt_configured = bool(settings.virustotal_api_key)
        provider_health = ProviderHealth(
            gemini_configured=gemini_configured,
            gemini_ok=gemini_configured or settings.analysis_demo_mode,
            virustotal_configured=vt_configured,
            virustotal_ok=vt_configured or settings.analysis_demo_mode,
            analysis_demo_mode=settings.analysis_demo_mode,
            detail=(
                "Mode démo actif — providers simulés"
                if settings.analysis_demo_mode
                else (
                    "Clés API présentes"
                    if gemini_configured and vt_configured
                    else "Au moins une clé API manquante"
                )
            ),
        )

        return AdminStatsResponse(
            users_count=users_count,
            reports_active_count=reports_active,
            reports_withdrawn_count=reports_withdrawn,
            threats_active_count=threats_active,
            threats_dismissed_count=threats_dismissed,
            threats_under_review_count=threats_under_review,
            guide_articles_published=self.guide.count_published_articles(),
            supported_applications=apps,
            gemini_configured=gemini_configured,
            virustotal_configured=vt_configured,
            analysis_demo_mode=settings.analysis_demo_mode,
            severity_distribution=severity_distribution,
            reports_last_7_days=reports_last_7_days,
            top_reported_threats=top_reported,
            provider_health=provider_health,
        )

    def list_users(self, *, page: int = 1, page_size: int = 20) -> AdminUserListResponse:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        total = int(self.db.scalar(select(func.count(User.id))) or 0)
        users = list(
            self.db.scalars(
                select(User)
                .order_by(User.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).all()
        )
        items: list[AdminUserItem] = []
        for user in users:
            devices_count = len(user.devices or [])
            reports_count = len(user.community_reports or [])
            items.append(
                AdminUserItem(
                    id=user.id,
                    username=user.username,
                    is_admin=user.is_admin,
                    created_at=user.created_at.isoformat() if user.created_at else "",
                    devices_count=devices_count,
                    reports_count=reports_count,
                )
            )
        return AdminUserListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    def list_threats(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: ThreatStatus | None = None,
    ) -> AdminThreatListResponse:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        items, total = self.threats.list_community(
            page=page,
            page_size=page_size,
            status=status,
        )
        return AdminThreatListResponse(
            items=[self._to_threat_response(t) for t in items],
            total=total,
            page=page,
            page_size=page_size,
            status_filter=status,
        )

    def update_threat_status(self, threat_id: int, new_status: ThreatStatus) -> ThreatResponse:
        threat = self.threats.get_by_id(threat_id)
        if threat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Menace introuvable",
            )
        updated = self.threats.update_status(threat, new_status)
        threat = self.threats.get_by_id(updated.id)
        return self._to_threat_response(threat)

    def list_reports(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: ReportStatus | None = None,
    ) -> AdminReportListResponse:
        items, total = self.reports.list_all(page=page, page_size=page_size, status=status)
        mapped: list[AdminReportItem] = []
        for report in items:
            threat = report.threat
            user = report.user
            mapped.append(
                AdminReportItem(
                    id=report.id,
                    threat_id=report.threat_id,
                    user_id=report.user_id,
                    username=user.username if user else "?",
                    source=report.source,
                    status=report.status,
                    created_at=report.created_at.isoformat() if report.created_at else "",
                    withdrawn_at=report.withdrawn_at.isoformat() if report.withdrawn_at else None,
                    severity=threat.severity if threat else ThreatSeverity.MEDIUM,
                    threat_preview=(threat.content if threat else "")[:160],
                    report_count=threat.report_count if threat else 0,
                )
            )
        return AdminReportListResponse(
            items=mapped,
            total=total,
            page=page,
            page_size=page_size,
            status_filter=status,
        )

    def withdraw_report(self, report_id: int) -> ReportResponse:
        report = self.reports.get_by_id(report_id)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signalement introuvable",
            )
        if report.status == ReportStatus.WITHDRAWN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signalement déjà retiré",
            )
        self.reports.withdraw(report)
        threat = self.threats.get_by_id(report.threat_id)
        if threat:
            self.threats.recount_active_reports(threat)
        self.db.commit()
        self.db.refresh(report)
        return ReportResponse.model_validate(report)

    def _to_threat_response(self, threat: Threat) -> ThreatResponse:
        return ThreatResponse(
            id=threat.id,
            raw_hash=threat.raw_hash,
            normalized_hash=threat.normalized_hash,
            content=threat.content,
            report_count=threat.report_count,
            community_score=threat.community_score,
            severity=threat.severity,
            status=threat.status,
            first_seen_at=threat.first_seen_at,
            last_seen_at=threat.last_seen_at,
            urls=[ThreatUrlResponse.model_validate(u) for u in (threat.urls or [])],
        )
