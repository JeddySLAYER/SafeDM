from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import ThreatStatus
from app.repositories.threat_repository import ThreatRepository
from app.schemas.report import ThreatListResponse, ThreatResponse, ThreatUrlResponse


class ThreatService:
    def __init__(self, db: Session):
        self.threats = ThreatRepository(db)

    def get_by_hash(self, value: str) -> ThreatResponse:
        threat = self.threats.get_by_hash(value)
        if threat is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menace introuvable")
        return self._to_response(threat)

    def list_community(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: ThreatStatus | None = ThreatStatus.ACTIVE,
    ) -> ThreatListResponse:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        items, total = self.threats.list_community(
            page=page,
            page_size=page_size,
            status=status,
        )
        return ThreatListResponse(
            items=[self._to_response(t) for t in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    def _to_response(self, threat) -> ThreatResponse:
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
