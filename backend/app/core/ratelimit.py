"""Small in-process sliding-window rate limiter (no extra dependency).

Adequate for a single API process at v1 volume. If the API is ever scaled to
several workers, swap the store for Redis — callers only use `rate_limit()`.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.core.config import get_settings

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _allow(key: str, limit: int, window: float) -> bool:
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        if len(_hits) > 50_000:  # crude memory bound
            for k in [k for k, v in _hits.items() if not v][:10_000]:
                _hits.pop(k, None)
        return True


def rate_limit(name: str, limit: int, window_seconds: int):
    """FastAPI dependency: `Depends(rate_limit("otp", 10, 900))` — per client IP."""

    def dependency(request: Request) -> None:
        settings = get_settings()
        if settings.disable_rate_limits and settings.is_local:
            return
        if not _allow(f"{name}:{client_ip(request)}", limit, window_seconds):
            raise HTTPException(status_code=429, detail={"error": {"code": "RATE_LIMITED"}})

    return dependency
