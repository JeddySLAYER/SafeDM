"""Simple in-memory rate limiter for auth and analysis endpoints."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

# path prefix (under /api/v1) -> (max_requests, window_seconds)
_LIMITS: dict[str, tuple[int, int]] = {
    "/auth/register": (10, 60),
    "/auth/login": (20, 60),
    "/auth/login/form": (20, 60),
    "/analysis": (60, 60),
}

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def check_rate_limit(request: Request, route_key: str) -> None:
    limit = _LIMITS.get(route_key)
    if not limit:
        return
    max_requests, window = limit
    key = f"{_client_key(request)}:{route_key}"
    now = time.monotonic()
    with _lock:
        bucket = _hits[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes. Réessayez dans une minute.",
            )
        bucket.append(now)


def reset_rate_limits_for_tests() -> None:
    with _lock:
        _hits.clear()
