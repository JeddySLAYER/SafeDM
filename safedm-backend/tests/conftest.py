"""Shared test data for the integration suite."""

import os

import pytest
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.rate_limit import reset_rate_limits_for_tests
from scripts.seed_applications import seed_applications
from scripts.seed_guide import seed_guide

# Hôtes considered as local: la suite y écrit librement.
_LOCAL_HOSTS = {
    "",
    "localhost",
    "127.0.0.1",
    "::1",
    "postgres",  # service du docker-compose local
    "db",
    "host.docker.internal",
}


@pytest.fixture(scope="session", autouse=True)
def _refuse_production_database():
    """Interdit d'exécuter la suite contre une base qui n'est pas locale.

    La suite écrit en base : utilisateurs, menaces, fingerprints, événements.
    Lancée contre la production, elle la pollue (constaté : 547 utilisateurs
    et 86 comptes `admin_*` parasites dans la base de dev locale, tous créés
    par la suite). Refuser bruyamment vaut mieux que polluer.
    """
    settings = get_settings()
    host = (make_url(settings.database_url).host or "").lower()
    is_local = host in _LOCAL_HOSTS
    is_production = settings.app_env.lower() == "production"

    if is_local and not is_production:
        return

    override = os.getenv("ALLOW_REMOTE_TEST_DB", "").lower()
    if override in {"1", "true", "yes"}:
        return

    pytest.fail(
        "Refus d'exécuter la suite de tests contre une base non locale "
        f"(host={host!r}, app_env={settings.app_env!r}).\n"
        "La suite écrit en base. Utilise une base locale (docker compose up -d postgres) "
        "ou pose ALLOW_REMOTE_TEST_DB=1 si c'est délibérément une base de dev jetable."
    )


@pytest.fixture(scope="session", autouse=True)
def seeded_reference_data(_refuse_production_database):
    """Ensure integration tests run against the documented reference catalog."""
    seed_applications()
    seed_guide()


@pytest.fixture(autouse=True)
def _disable_rate_limits_in_tests(monkeypatch):
    """Integration suites register many users from the same TestClient IP."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    get_settings.cache_clear()
    reset_rate_limits_for_tests()
    yield
    get_settings.cache_clear()
    reset_rate_limits_for_tests()
