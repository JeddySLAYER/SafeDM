from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import cast, Date, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    CommunityReport,
    Device,
    GuideArticle,
    LinkGateEvent,
    SupportedApplication,
    Threat,
    User,
)
from app.models.enums import ReportStatus, ThreatSeverity, ThreatStatus
from app.repositories.monitoring_repository import ApplicationRepository, MonitoringRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.threat_repository import ThreatRepository
from app.schemas.admin import (
    AdminDeviceItem,
    AdminReportItem,
    AdminReportListResponse,
    AdminStatsResponse,
    AdminThreatDetailResponse,
    AdminThreatListResponse,
    AdminThreatUrlDetail,
    AdminUserDetailResponse,
    AdminUserItem,
    AdminUserListResponse,
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    DayCount,
    LinkGateEventItem,
    LinkGateEventListResponse,
    ProviderHealth,
    SeverityBucket,
    TopThreatItem,
    VirusTotalScanItem,
)
from app.schemas.monitoring import ApplicationResponse, MonitoringPreferenceResponse
from app.schemas.report import ReportResponse, ThreatResponse, ThreatUrlResponse


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.threats = ThreatRepository(db)
        self.reports = ReportRepository(db)
        self.applications = ApplicationRepository(db)
        self.monitoring = MonitoringRepository(db)

    def stats(self) -> AdminStatsResponse:
        """Stats admin — requêtes agrégées (évite 10+ round-trips vers Neon)."""
        settings = get_settings()

        # 1 round-trip : compteurs scalaires
        users_count, apps, articles_published, link_events = self.db.execute(
            select(
                select(func.count()).select_from(User).scalar_subquery(),
                select(func.count()).select_from(SupportedApplication).scalar_subquery(),
                select(func.count())
                .select_from(GuideArticle)
                .where(GuideArticle.is_published.is_(True))
                .scalar_subquery(),
                select(func.count()).select_from(LinkGateEvent).scalar_subquery(),
            )
        ).one()

        # 1 : menaces par statut
        threat_by_status = {
            status_val: int(cnt)
            for status_val, cnt in self.db.execute(
                select(Threat.status, func.count(Threat.id)).group_by(Threat.status)
            ).all()
        }
        threats_active = threat_by_status.get(ThreatStatus.ACTIVE, 0)
        threats_dismissed = threat_by_status.get(ThreatStatus.DISMISSED, 0)
        threats_under_review = threat_by_status.get(ThreatStatus.UNDER_REVIEW, 0)

        # 1 : signalements par statut
        report_by_status = {
            status_val: int(cnt)
            for status_val, cnt in self.db.execute(
                select(CommunityReport.status, func.count(CommunityReport.id)).group_by(
                    CommunityReport.status
                )
            ).all()
        }
        reports_active = report_by_status.get(ReportStatus.ACTIVE, 0)
        reports_withdrawn = report_by_status.get(ReportStatus.WITHDRAWN, 0)

        # 1 : sévérité (actives seulement)
        severity_distribution = [
            SeverityBucket(severity=sev, count=int(cnt))
            for sev, cnt in self.db.execute(
                select(Threat.severity, func.count(Threat.id))
                .where(Threat.status == ThreatStatus.ACTIVE)
                .group_by(Threat.severity)
            ).all()
        ]

        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=6)

        # 1 : séries 7 jours (reports + threats) via 2 group-by dans le même execute batch
        # → 2 queries mais c’est le minimum utile pour les courbes
        report_day_rows = {
            str(day): int(cnt)
            for day, cnt in self.db.execute(
                select(
                    cast(CommunityReport.created_at, Date),
                    func.count(CommunityReport.id),
                )
                .where(CommunityReport.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
                .group_by(cast(CommunityReport.created_at, Date))
            ).all()
        }
        threat_day_rows = {
            str(day): int(cnt)
            for day, cnt in self.db.execute(
                select(cast(Threat.first_seen_at, Date), func.count(Threat.id))
                .where(Threat.first_seen_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
                .group_by(cast(Threat.first_seen_at, Date))
            ).all()
        }
        reports_last_7_days = [
            DayCount(
                day=str(start + timedelta(days=i)),
                reports=report_day_rows.get(str(start + timedelta(days=i)), 0),
                threats=threat_day_rows.get(str(start + timedelta(days=i)), 0),
            )
            for i in range(7)
        ]

        # 1 : top menaces
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
            users_count=int(users_count or 0),
            reports_active_count=reports_active,
            reports_withdrawn_count=reports_withdrawn,
            threats_active_count=threats_active,
            threats_dismissed_count=threats_dismissed,
            threats_under_review_count=threats_under_review,
            guide_articles_published=int(articles_published or 0),
            supported_applications=int(apps or 0),
            gemini_configured=gemini_configured,
            virustotal_configured=vt_configured,
            analysis_demo_mode=settings.analysis_demo_mode,
            severity_distribution=severity_distribution,
            reports_last_7_days=reports_last_7_days,
            top_reported_threats=top_reported,
            provider_health=provider_health,
            link_gate_events_count=int(link_events or 0),
        )

    def list_users(self, *, page: int = 1, page_size: int = 20) -> AdminUserListResponse:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        total = int(self.db.scalar(select(func.count(User.id))) or 0)

        devices_sq = (
            select(func.count(Device.id))
            .where(Device.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
            .label("devices_count")
        )
        reports_sq = (
            select(func.count(CommunityReport.id))
            .where(CommunityReport.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
            .label("reports_count")
        )

        rows = self.db.execute(
            select(User, devices_sq, reports_sq)
            .order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()

        items = [
            AdminUserItem(
                id=user.id,
                username=user.username,
                is_admin=user.is_admin,
                created_at=user.created_at.isoformat() if user.created_at else "",
                devices_count=int(devices_count or 0),
                reports_count=int(reports_count or 0),
            )
            for user, devices_count, reports_count in rows
        ]
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

    def update_threat_severity(
        self, threat_id: int, severity: ThreatSeverity
    ) -> ThreatResponse:
        threat = self.threats.get_by_id(threat_id)
        if threat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Menace introuvable",
            )
        updated = self.threats.update_severity(threat, severity)
        threat = self.threats.get_by_id(updated.id)
        return self._to_threat_response(threat)

    def get_threat_detail(self, threat_id: int) -> AdminThreatDetailResponse:
        threat = self.threats.get_by_id_with_scans(threat_id)
        if threat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Menace introuvable",
            )
        urls: list[AdminThreatUrlDetail] = []
        for u in threat.urls or []:
            urls.append(
                AdminThreatUrlDetail(
                    id=u.id,
                    original_url=u.original_url,
                    domain=u.domain,
                    url_hash=u.url_hash,
                    scans=[
                        VirusTotalScanItem(
                            id=s.id,
                            status=s.status,
                            result=s.result,
                            scanned_at=s.scanned_at.isoformat() if s.scanned_at else "",
                        )
                        for s in (u.scans or [])
                    ],
                )
            )
        return AdminThreatDetailResponse(
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
            urls=urls,
        )

    def get_user_detail(self, user_id: int) -> AdminUserDetailResponse:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur introuvable",
            )
        devices = [
            AdminDeviceItem(
                id=d.id,
                device_identifier=d.device_identifier,
                created_at=d.created_at.isoformat() if d.created_at else "",
                last_seen_at=d.last_seen_at.isoformat() if d.last_seen_at else None,
            )
            for d in (user.devices or [])
        ]
        prefs = self.monitoring.list_for_user(user_id)
        monitoring = [
            MonitoringPreferenceResponse(
                id=p.id,
                application_id=p.application_id,
                enabled=p.enabled,
                updated_at=p.updated_at,
                application=ApplicationResponse.model_validate(p.application),
            )
            for p in prefs
            if p.application is not None
        ]
        reports_count = int(
            self.db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.user_id == user_id
                )
            )
            or 0
        )
        return AdminUserDetailResponse(
            id=user.id,
            username=user.username,
            is_admin=user.is_admin,
            created_at=user.created_at.isoformat() if user.created_at else "",
            devices=devices,
            monitoring=monitoring,
            reports_count=reports_count,
        )

    def update_user(
        self,
        user_id: int,
        *,
        is_admin: bool | None,
        actor: User,
    ) -> AdminUserDetailResponse:
        user = self.db.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur introuvable",
            )
        if is_admin is not None:
            if user.id == actor.id and is_admin is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Impossible de retirer vos propres droits admin",
                )
            if user.is_admin and is_admin is False:
                other_admins = int(
                    self.db.scalar(
                        select(func.count(User.id)).where(
                            User.is_admin.is_(True),
                            User.id != user.id,
                        )
                    )
                    or 0
                )
                if other_admins == 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Impossible de retirer le dernier administrateur",
                    )
            user.is_admin = is_admin
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        return self.get_user_detail(user_id)

    def list_applications(self) -> list[ApplicationResponse]:
        return [
            ApplicationResponse.model_validate(a) for a in self.applications.list_all()
        ]

    def create_application(self, payload: ApplicationCreateRequest) -> ApplicationResponse:
        existing = self.applications.get_by_package(payload.package_name.strip())
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Package déjà présent",
            )
        app = self.applications.create(
            name=payload.name,
            package_name=payload.package_name,
            is_enabled=payload.is_enabled,
        )
        return ApplicationResponse.model_validate(app)

    def update_application(
        self, application_id: int, payload: ApplicationUpdateRequest
    ) -> ApplicationResponse:
        app = self.applications.get_by_id(application_id)
        if app is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application introuvable",
            )
        updated = self.applications.update(
            app,
            name=payload.name,
            is_enabled=payload.is_enabled,
        )
        return ApplicationResponse.model_validate(updated)

    def delete_application(self, application_id: int) -> None:
        app = self.applications.get_by_id(application_id)
        if app is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application introuvable",
            )
        self.applications.delete(app)

    def list_link_gate_events(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        decision: str | None = None,
    ) -> LinkGateEventListResponse:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        count_stmt = select(func.count(LinkGateEvent.id))
        stmt = (
            select(LinkGateEvent)
            .order_by(LinkGateEvent.created_at.desc())
        )
        if decision:
            count_stmt = count_stmt.where(LinkGateEvent.decision == decision.upper())
            stmt = stmt.where(LinkGateEvent.decision == decision.upper())
        total = int(self.db.scalar(count_stmt) or 0)
        events = list(
            self.db.scalars(
                stmt.offset((page - 1) * page_size).limit(page_size)
            ).all()
        )
        user_ids = {e.user_id for e in events if e.user_id}
        usernames: dict[int, str] = {}
        if user_ids:
            for u in self.db.scalars(select(User).where(User.id.in_(user_ids))).all():
                usernames[u.id] = u.username
        items = [
            LinkGateEventItem(
                id=e.id,
                user_id=e.user_id,
                username=usernames.get(e.user_id) if e.user_id else None,
                url=e.url,
                domain=e.domain,
                decision=e.decision,
                risk_score=e.risk_score,
                severity=e.severity,
                status=e.status,
                created_at=e.created_at.isoformat() if e.created_at else "",
            )
            for e in events
        ]
        return LinkGateEventListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

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
