from app.models import AccessAuditLog


def test_audit_log_has_actor_purpose_and_resource_fields():
    columns = AccessAuditLog.__table__.c
    assert {"user_id", "action", "resource", "purpose", "created_at"} <= set(columns.keys())
