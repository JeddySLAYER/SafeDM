"""Add link_gate_events for admin Link Gate journal.

Revision ID: 0002_link_gate_events
Revises: 0001_initial_schema
Create Date: 2026-08-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_link_gate_events"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "link_gate_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("decision", sa.String(length=16), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="LOW"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="UNKNOWN"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_link_gate_events_user_id", "link_gate_events", ["user_id"])
    op.create_index("ix_link_gate_events_domain", "link_gate_events", ["domain"])
    op.create_index("ix_link_gate_events_decision", "link_gate_events", ["decision"])
    op.create_index("ix_link_gate_events_created_at", "link_gate_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_link_gate_events_created_at", table_name="link_gate_events")
    op.drop_index("ix_link_gate_events_decision", table_name="link_gate_events")
    op.drop_index("ix_link_gate_events_domain", table_name="link_gate_events")
    op.drop_index("ix_link_gate_events_user_id", table_name="link_gate_events")
    op.drop_table("link_gate_events")
