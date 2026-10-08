"""ML datasets + train runs for admin training ops."""

from alembic import op
import sqlalchemy as sa

revision = "0005_ml_datasets_train_runs"
down_revision = "0004_admin_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ml_datasets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="upload"),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("benign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("malicious_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_json", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "ml_train_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("ml_datasets.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("publishable", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("metrics_json", sa.Text(), nullable=True),
        sa.Column("log_text", sa.Text(), nullable=True),
        sa.Column("artifact_path", sa.String(length=512), nullable=True),
        sa.Column("artifact_sha256", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("triggered_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("ml_train_runs")
    op.drop_table("ml_datasets")
