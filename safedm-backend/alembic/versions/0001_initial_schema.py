"""Initial SafeDM schema — 10 tables (PostgreSQL)

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=False)

    op.create_table(
        "supported_applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("package_name", sa.String(length=255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("package_name"),
    )
    op.create_index(
        "ix_supported_applications_package_name",
        "supported_applications",
        ["package_name"],
        unique=False,
    )

    op.create_table(
        "guide_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "threats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("raw_hash", sa.String(length=64), nullable=False),
        sa.Column("normalized_hash", sa.String(length=64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("report_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("community_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "first_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_threats_raw_hash", "threats", ["raw_hash"], unique=False)
    op.create_index("ix_threats_normalized_hash", "threats", ["normalized_hash"], unique=False)

    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("device_identifier", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "device_identifier", name="uq_devices_user_identifier"),
    )

    op.create_table(
        "monitoring_preferences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["application_id"], ["supported_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "application_id",
            name="uq_monitoring_user_application",
        ),
    )

    op.create_table(
        "guide_articles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["guide_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_guide_articles_category_id", "guide_articles", ["category_id"], unique=False)

    op.create_table(
        "community_reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("threat_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["threat_id"], ["threats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "threat_id", name="uq_community_reports_user_threat"),
    )
    op.create_index("ix_community_reports_threat_id", "community_reports", ["threat_id"], unique=False)
    op.create_index("ix_community_reports_user_id", "community_reports", ["user_id"], unique=False)

    op.create_table(
        "threat_urls",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("threat_id", sa.Integer(), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("url_hash", sa.String(length=64), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["threat_id"], ["threats.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_threat_urls_threat_id", "threat_urls", ["threat_id"], unique=False)
    op.create_index("ix_threat_urls_url_hash", "threat_urls", ["url_hash"], unique=False)
    op.create_index("ix_threat_urls_domain", "threat_urls", ["domain"], unique=False)

    op.create_table(
        "virustotal_scans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("threat_url_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("raw_result", sa.JSON(), nullable=True),
        sa.Column(
            "scanned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["threat_url_id"], ["threat_urls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_virustotal_scans_threat_url_id",
        "virustotal_scans",
        ["threat_url_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_virustotal_scans_threat_url_id", table_name="virustotal_scans")
    op.drop_table("virustotal_scans")

    op.drop_index("ix_threat_urls_domain", table_name="threat_urls")
    op.drop_index("ix_threat_urls_url_hash", table_name="threat_urls")
    op.drop_index("ix_threat_urls_threat_id", table_name="threat_urls")
    op.drop_table("threat_urls")

    op.drop_index("ix_community_reports_user_id", table_name="community_reports")
    op.drop_index("ix_community_reports_threat_id", table_name="community_reports")
    op.drop_table("community_reports")

    op.drop_index("ix_guide_articles_category_id", table_name="guide_articles")
    op.drop_table("guide_articles")

    op.drop_table("monitoring_preferences")
    op.drop_table("devices")

    op.drop_index("ix_threats_normalized_hash", table_name="threats")
    op.drop_index("ix_threats_raw_hash", table_name="threats")
    op.drop_table("threats")

    op.drop_table("guide_categories")

    op.drop_index("ix_supported_applications_package_name", table_name="supported_applications")
    op.drop_table("supported_applications")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
