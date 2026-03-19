"""FastAPI dependency: resolves the owner session cookie/header into an
Account, or 401s. Used by every /api/app/* route (SRS-15.6 — owners access
only their own outlet's data, enforced server-side).
"""

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.account import Account
from app.services.owner_auth import resolve_session


def get_current_owner(
    session_token: str | None = Cookie(default=None), db: Session = Depends(get_db)
) -> Account:
    if not session_token:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED"}})
    account = resolve_session(db, session_token)
    if account is None:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED"}})
    return account
