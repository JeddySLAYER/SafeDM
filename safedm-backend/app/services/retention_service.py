from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.models import CommunityReport, Threat
from app.models.enums import ReportStatus


def purge_inactive_fingerprints(
    db: Session,
    *,
    inactive_days: int = 183,
) -> int:
    """Delete inactive fingerprint threats and their reports after six months."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=inactive_days)
    ids = select(Threat.id).where(
        Threat.similarity_hash.is_not(None),
        Threat.last_seen_at < cutoff,
        ~exists().where(
            CommunityReport.threat_id == Threat.id,
            CommunityReport.status == ReportStatus.ACTIVE,
        ),
    )
    result = db.execute(delete(Threat).where(Threat.id.in_(ids)))
    db.commit()
    return int(result.rowcount or 0)
