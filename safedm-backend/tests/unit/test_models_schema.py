"""Tests schéma / modèles (sans connexion PostgreSQL obligatoire)."""

from sqlalchemy.schema import UniqueConstraint

from app.core.database import Base
from app import models  # noqa: F401


EXPECTED_TABLES = {
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
    "link_gate_events",
}


def test_all_tables_registered():
    assert EXPECTED_TABLES.issubset(set(Base.metadata.tables.keys()))
    assert len(EXPECTED_TABLES) == 11


def test_users_username_unique():
    table = Base.metadata.tables["users"]
    assert any(c.name == "username" and c.unique for c in table.columns)


def test_community_reports_unique_user_threat():
    table = Base.metadata.tables["community_reports"]
    uniques = [
        uc
        for uc in table.constraints
        if isinstance(uc, UniqueConstraint)
    ]
    assert any(
        set(uc.columns.keys()) == {"user_id", "threat_id"} for uc in uniques
    )


def test_monitoring_unique_user_application():
    table = Base.metadata.tables["monitoring_preferences"]
    uniques = [
        uc
        for uc in table.constraints
        if isinstance(uc, UniqueConstraint)
    ]
    assert any(
        set(uc.columns.keys()) == {"user_id", "application_id"} for uc in uniques
    )


def test_threat_indexes():
    table = Base.metadata.tables["threats"]
    index_cols = {tuple(idx.columns.keys()) for idx in table.indexes}
    assert ("raw_hash",) in index_cols
    assert ("normalized_hash",) in index_cols


def test_no_full_message_analysis_history_table():
    """Pas de table d'historique de messages analysés (contenu non stocké)."""
    assert "analyses" not in Base.metadata.tables
    assert "analysis_history" not in Base.metadata.tables
    # link_gate_events = journal ops URL/décision uniquement
    assert "link_gate_events" in Base.metadata.tables
