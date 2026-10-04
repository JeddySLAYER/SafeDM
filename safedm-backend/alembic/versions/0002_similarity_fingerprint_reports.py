"""Add similarity fingerprints for content-free community reports."""

from alembic import op
import sqlalchemy as sa

revision = "0002_similarity_reports"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("threats", "content", existing_type=sa.Text(), nullable=True)
    op.add_column("threats", sa.Column("similarity_hash", sa.String(length=16), nullable=True))
    op.create_index("ix_threats_similarity_hash", "threats", ["similarity_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_threats_similarity_hash", table_name="threats")
    op.drop_column("threats", "similarity_hash")
    op.alter_column("threats", "content", existing_type=sa.Text(), nullable=False)
