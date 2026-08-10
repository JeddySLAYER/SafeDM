from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import CommunityReport, SupportedApplication, Threat, User
from app.models.enums import ReportStatus, ThreatStatus
from app.repositories.guide_repository import GuideRepository
from app.repositories.threat_repository import ThreatRepository
from app.schemas.admin import (
    AdminStatsResponse,
    AdminThreatListResponse,
    AdminUserItem,
    AdminUserListResponse,
)
from app.schemas.report import ThreatResponse, ThreatUrlResponse


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.guide = GuideRepository(db)
        self.threats = ThreatRepository(db)

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
        apps = int(self.db.scalar(select(func.count(SupportedApplication.id))) or 0)

        return AdminStatsResponse(
            users_count=users_count,
            reports_active_count=reports_active,
            reports_withdrawn_count=reports_withdrawn,
            threats_active_count=threats_active,
            threats_dismissed_count=threats_dismissed,
            guide_articles_published=self.guide.count_published_articles(),
            supported_applications=apps,
            gemini_configured=bool(settings.gemini_api_key),
            virustotal_configured=bool(settings.virustotal_api_key),
            analysis_demo_mode=settings.analysis_demo_mode,
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
