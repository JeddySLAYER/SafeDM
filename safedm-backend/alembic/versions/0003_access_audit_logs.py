"""Add audit trail for signature-base access."""

from alembic import op
import sqlalchemy as sa

revision = "0003_access_audit_logs"
down_revision = ("0002_similarity_fingerprint_reports", "0002_link_gate_events")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "access_audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource", sa.String(length=128), nullable=False),
        sa.Column("purpose", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_access_audit_logs_user_id", "access_audit_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_access_audit_logs_user_id", table_name="access_audit_logs")
    op.drop_table("access_audit_logs")
