"""Persist admin workflows and tenant policies."""

from alembic import op
import sqlalchemy as sa

revision = "0004_admin_operations"
down_revision = "0003_access_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("threats", sa.Column("false_positive", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_table(
        "patch_deployments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(128), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="CANARY"),
        sa.Column("rollout_percentage", sa.Float(), nullable=False, server_default="1"),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
    )
    op.create_table(
        "aggregation_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="REQUESTED"),
        sa.Column("requested_by", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
    )
    op.create_table(
        "tenant_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_key", sa.String(128), nullable=False, unique=True),
        sa.Column("region", sa.String(64), nullable=False, server_default="global"),
        sa.Column("safe_score", sa.Integer(), nullable=False),
        sa.Column("suspicious_score", sa.Integer(), nullable=False),
        sa.Column("critical_score", sa.Integer(), nullable=False),
        sa.Column("escalation_confidence", sa.Float(), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
    )


def downgrade() -> None:
    op.drop_table("tenant_policies")
    op.drop_table("aggregation_runs")
    op.drop_table("patch_deployments")
    op.drop_column("threats", "false_positive")
