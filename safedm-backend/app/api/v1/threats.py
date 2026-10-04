from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.models.enums import ThreatStatus
from app.schemas.report import ThreatListResponse, ThreatResponse
from app.services.threat_service import ThreatService
from app.services.audit_service import record_access

router = APIRouter(prefix="/threats", tags=["threats"])


@router.get("/community", response_model=ThreatListResponse)
def list_community_threats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    record_access(
        db,
        user_id=current_user.id,
        action="list",
        resource="threat_signatures",
        purpose="community_analysis",
    )
    db.commit()
    return ThreatService(db).list_community(
        page=page,
        page_size=page_size,
        status=ThreatStatus.ACTIVE,
    )


@router.get("/{threat_hash}", response_model=ThreatResponse)
def get_threat_by_hash(
    threat_hash: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = current_user
    record_access(
        db,
        user_id=current_user.id,
        action="read",
        resource="threat_signature",
        purpose="community_analysis",
    )
    db.commit()
    return ThreatService(db).get_by_hash(threat_hash)
