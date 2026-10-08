"""Legal documents and per-user acceptances."""

from alembic import op
import sqlalchemy as sa

revision = "0007_legal_documents"
down_revision = "0006_user_firebase_uid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legal_documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_legal_documents_slug"),
    )
    op.create_table(
        "legal_acceptances",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("legal_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "document_id", name="uq_legal_acceptance"),
    )
    op.create_index("ix_legal_acceptances_user_id", "legal_acceptances", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_legal_acceptances_user_id", table_name="legal_acceptances")
    op.drop_table("legal_acceptances")
    op.drop_table("legal_documents")
