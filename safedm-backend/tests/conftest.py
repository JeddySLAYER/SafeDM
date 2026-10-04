"""Shared test data for the integration suite."""

import pytest

from scripts.seed_applications import seed_applications
from scripts.seed_guide import seed_guide


@pytest.fixture(scope="session", autouse=True)
def seeded_reference_data():
    """Ensure integration tests run against the documented reference catalog."""
    seed_applications()
    seed_guide()
