"""Vérifie la connexion PostgreSQL et la présence des tables après migration.

Skip automatique si PostgreSQL n'est pas disponible.
"""

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.core.database import engine


REQUIRED_TABLES = {
    "users",
    "devices",
    "supported_applications",
    "monitoring_preferences",
    "threats",
    "community_reports",
    "threat_urls",
    "virustotal_scans",
    "guide_categories",
    "guide_articles",
}


def _postgres_available() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False


pytestmark = pytest.mark.skipif(
    not _postgres_available(),
    reason="Base indisponible — configure DATABASE_URL (.env) puis uv run alembic upgrade head",
)


def test_postgres_connection():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1


def test_migrated_tables_exist():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    missing = REQUIRED_TABLES - tables
    assert not missing, f"Tables manquantes: {missing}"
