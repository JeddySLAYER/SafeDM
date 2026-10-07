"""Shared test data for the integration suite."""

import pytest

from app.core.config import get_settings
from app.core.rate_limit import reset_rate_limits_for_tests
from scripts.seed_applications import seed_applications
from scripts.seed_guide import seed_guide


@pytest.fixture(scope="session", autouse=True)
def seeded_reference_data():
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
