"""Record model patch receipt acknowledgements without raw device identifiers."""

from alembic import op
import sqlalchemy as sa

revision = "0009_model_device_receipts"
down_revision = "0008_report_training_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_device_receipts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("version", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_hash", sa.String(length=64), nullable=False),
        sa.Column("app_version", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="applied"),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("version", "user_id", "device_hash", name="uq_model_receipt_device_version"),
    )
    op.create_index("ix_model_device_receipts_version", "model_device_receipts", ["version"])


def downgrade() -> None:
    op.drop_index("ix_model_device_receipts_version", table_name="model_device_receipts")
    op.drop_table("model_device_receipts")
