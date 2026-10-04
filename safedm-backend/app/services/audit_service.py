from sqlalchemy.orm import Session

from app.models import AccessAuditLog


def record_access(
    db: Session,
    *,
    user_id: int,
    action: str,
    resource: str,
    purpose: str,
) -> None:
    db.add(
        AccessAuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            purpose=purpose,
        )
    )
