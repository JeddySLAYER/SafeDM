from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import CommunityReport, Threat, ThreatUrl, VirusTotalScan
from app.models.enums import ReportStatus, ThreatSeverity, ThreatStatus, VirusTotalResult
from app.schemas.analysis import CommunityMatch
from app.utils.hashing import compute_normalized_hash, compute_raw_hash, compute_url_hash
from app.utils.url_extraction import extract_domain, extract_urls


class ThreatRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_hashes(self, raw_hash: str, normalized_hash: str) -> CommunityMatch:
        threat = self.db.scalar(
            select(Threat)
            .where(
                Threat.status == ThreatStatus.ACTIVE,
                or_(
                    Threat.raw_hash == raw_hash,
                    Threat.normalized_hash == normalized_hash,
                ),
            )
            .order_by(Threat.report_count.desc())
        )
        if threat is None:
            return CommunityMatch(
                matched=False,
                raw_hash=raw_hash,
                normalized_hash=normalized_hash,
            )
        return CommunityMatch(
            matched=True,
            threat_id=threat.id,
            report_count=threat.report_count,
            community_score=threat.community_score,
            severity=threat.severity,
            raw_hash=raw_hash,
            normalized_hash=normalized_hash,
        )

    def get_by_id(self, threat_id: int) -> Threat | None:
        return (
            self.db.scalars(
                select(Threat)
                .options(joinedload(Threat.urls))
                .where(Threat.id == threat_id)
            )
            .unique()
            .first()
        )

    def get_by_hash(self, value: str) -> Threat | None:
        return (
            self.db.scalars(
                select(Threat)
                .options(joinedload(Threat.urls))
                .where(
                    or_(
                        Threat.raw_hash == value,
                        Threat.normalized_hash == value,
                    )
                )
                .order_by(Threat.report_count.desc())
            )
            .unique()
            .first()
        )

    def list_community(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: ThreatStatus | None = ThreatStatus.ACTIVE,
    ) -> tuple[list[Threat], int]:
        query = select(Threat).options(joinedload(Threat.urls))
        count_query = select(func.count(Threat.id))
        if status is not None:
            query = query.where(Threat.status == status)
            count_query = count_query.where(Threat.status == status)
        total = int(self.db.scalar(count_query) or 0)
        items = list(
            self.db.scalars(
                query.order_by(Threat.report_count.desc(), Threat.last_seen_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .unique()
            .all()
        )
        return items, total

    def get_or_create_from_content(
        self,
        *,
        content: str,
        severity: ThreatSeverity,
    ) -> tuple[Threat, bool]:
        raw_hash = compute_raw_hash(content)
        normalized_hash = compute_normalized_hash(content)
        existing = self.db.scalar(
            select(Threat).where(Threat.normalized_hash == normalized_hash)
        )
        now = datetime.now(timezone.utc)
        if existing:
            existing.last_seen_at = now
            if severity.value and existing.severity:
                # Keep the higher severity
                order = {
                    ThreatSeverity.LOW: 1,
                    ThreatSeverity.MEDIUM: 2,
                    ThreatSeverity.HIGH: 3,
                    ThreatSeverity.CRITICAL: 4,
                }
                if order[severity] > order[existing.severity]:
                    existing.severity = severity
            self.db.add(existing)
            self.db.flush()
            return existing, False

        threat = Threat(
            raw_hash=raw_hash,
            normalized_hash=normalized_hash,
            content=content,
            report_count=0,
            community_score=0.0,
            severity=severity,
            status=ThreatStatus.ACTIVE,
            first_seen_at=now,
            last_seen_at=now,
        )
        self.db.add(threat)
        self.db.flush()

        for url in extract_urls(content):
            self.db.add(
                ThreatUrl(
                    threat_id=threat.id,
                    original_url=url,
                    url_hash=compute_url_hash(url),
                    domain=extract_domain(url),
                )
            )
        self.db.flush()
        return threat, True

    def recount_active_reports(self, threat: Threat) -> Threat:
        active_count = int(
            self.db.scalar(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.threat_id == threat.id,
                    CommunityReport.status == ReportStatus.ACTIVE,
                )
            )
            or 0
        )
        threat.report_count = active_count
        threat.community_score = float(active_count * 10)
        threat.last_seen_at = datetime.now(timezone.utc)
        self.db.add(threat)
        self.db.flush()
        return threat

    def update_status(self, threat: Threat, status: ThreatStatus) -> Threat:
        threat.status = status
        threat.last_seen_at = datetime.now(timezone.utc)
        self.db.add(threat)
        self.db.commit()
        self.db.refresh(threat)
        return threat
