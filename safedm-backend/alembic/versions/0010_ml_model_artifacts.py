"""Persisted TFLite artifacts and review state."""

from alembic import op
import sqlalchemy as sa

revision = "0010_ml_model_artifacts"
down_revision = "0009_model_device_receipts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ml_train_runs", sa.Column("review_status", sa.String(32), nullable=False, server_default="pending"))
    op.add_column("ml_train_runs", sa.Column("review_note", sa.Text(), nullable=True))
    op.add_column("ml_train_runs", sa.Column("reviewed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_table(
        "ml_model_artifacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("ml_datasets.id"), nullable=False),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("ml_train_runs.id"), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(512), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="uploaded"),
        sa.Column("review_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("evaluation_json", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    for name, column in (
        ("dataset_id", "dataset_id"),
        ("run_id", "run_id"),
        ("sha256", "sha256"),
    ):
        op.create_index(f"ix_ml_model_artifacts_{name}", "ml_model_artifacts", [column])


def downgrade() -> None:
    op.drop_index("ix_ml_model_artifacts_sha256", table_name="ml_model_artifacts")
    op.drop_index("ix_ml_model_artifacts_run_id", table_name="ml_model_artifacts")
    op.drop_index("ix_ml_model_artifacts_dataset_id", table_name="ml_model_artifacts")
    op.drop_table("ml_model_artifacts")
    op.drop_column("ml_train_runs", "reviewed_by_user_id")
    op.drop_column("ml_train_runs", "review_note")
    op.drop_column("ml_train_runs", "review_status")
