"""Persist admin reviewed report labels and dataset linkage."""

from alembic import op
import sqlalchemy as sa

revision = "0008_report_training_reviews"
down_revision = "0007_legal_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_training_reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("community_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expected", sa.String(length=16), nullable=False),
        sa.Column("reviewed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "dataset_id",
            sa.Integer(),
            sa.ForeignKey("ml_datasets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("report_id", name="uq_report_training_reviews_report"),
    )
    op.create_index(
        "ix_report_training_reviews_report_id", "report_training_reviews", ["report_id"]
    )
    op.create_index(
        "ix_report_training_reviews_dataset_id", "report_training_reviews", ["dataset_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_report_training_reviews_dataset_id", table_name="report_training_reviews")
    op.drop_index("ix_report_training_reviews_report_id", table_name="report_training_reviews")
    op.drop_table("report_training_reviews")
