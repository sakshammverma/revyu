"""Founder-only admin auth. Not linked publicly, not indexed (04-ARCHITECTURE.md §3.3).

v1 stopgap: a single shared bearer token compared against ADMIN_SESSION_SECRET.
At one founder and ten outlets this is adequate; a real admin identity/session
system is a §12 scaling item, not a v1 blocker (only one person ever holds
this token).
"""

import hmac

from fastapi import Header, HTTPException

from app.core.config import get_settings


def require_admin(authorization: str = Header(default="")) -> None:
    settings = get_settings()
    expected = f"Bearer {settings.admin_session_secret}"
    if not settings.admin_session_secret or not hmac.compare_digest(
        authorization.encode(), expected.encode()
    ):
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED"}})
