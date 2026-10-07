from fastapi import HTTPException

from app.core.rate_limit import check_rate_limit, reset_rate_limits_for_tests


class _Client:
    host = "203.0.113.10"


class _Request:
    def __init__(self):
        self.headers = {}
        self.client = _Client()


def test_rate_limit_trips_after_max():
    reset_rate_limits_for_tests()
    request = _Request()
    for _ in range(10):
        check_rate_limit(request, "/auth/register")
    try:
        check_rate_limit(request, "/auth/register")
        raised = False
    except HTTPException as exc:
        raised = True
        assert exc.status_code == 429
    assert raised
