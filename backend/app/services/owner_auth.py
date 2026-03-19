"""Owner login: email + OTP, no password (SRS-10.1, OD-16).

6-digit code, 10-minute expiry, max 5 attempts (SRS-10.2). A single-use magic
link ships alongside the code (SRS-10.1a). Session duration 30 days,
revocable (SRS-10.3). Rate-limited per email and per IP (SRS-15.2) — IP
limiting belongs at the endpoint layer (app/api/auth.py), not here.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.otp import OtpCode
from app.models.owner_session import OwnerSession

OTP_EXPIRY = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
OTP_REQUEST_WINDOW = timedelta(minutes=15)
OTP_REQUEST_MAX_PER_WINDOW = 3
SESSION_DURATION = timedelta(days=30)


def _hash(value: str) -> str:
    """Tokens are stored hashed; only the holder of the raw value can use them."""
    return hashlib.sha256(value.encode()).hexdigest()


class OtpRateLimitedError(Exception):
    pass


class OtpInvalidError(Exception):
    pass


class OtpAttemptsExceededError(Exception):
    pass


def request_otp(db: Session, account: Account) -> tuple[str, str]:
    """Returns (code, magic_token). Caller is responsible for sending it."""
    window_start = datetime.now(timezone.utc) - OTP_REQUEST_WINDOW
    recent = db.scalars(
        select(OtpCode).where(OtpCode.account_id == account.id, OtpCode.created_at >= window_start)
    ).all()
    if len(recent) >= OTP_REQUEST_MAX_PER_WINDOW:
        raise OtpRateLimitedError()

    code = f"{secrets.randbelow(1_000_000):06d}"
    magic_token = secrets.token_urlsafe(32)

    otp = OtpCode(
        account_id=account.id,
        code=code,
        magic_token=_hash(magic_token),
        expires_at=datetime.now(timezone.utc) + OTP_EXPIRY,
    )
    db.add(otp)
    db.flush()
    return code, magic_token


def verify_otp(db: Session, account: Account, code: str) -> OwnerSession:
    otp = db.scalar(
        select(OtpCode)
        .where(OtpCode.account_id == account.id, OtpCode.consumed.is_(False))
        .order_by(OtpCode.created_at.desc())
    )
    if otp is None:
        raise OtpInvalidError()

    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise OtpAttemptsExceededError()

    if datetime.now(timezone.utc) > otp.expires_at:
        raise OtpInvalidError()

    if not secrets.compare_digest(otp.code, code):
        otp.attempts += 1
        db.flush()
        raise OtpInvalidError()

    otp.consumed = True
    db.flush()
    return _issue_session(db, account)


def verify_magic_link(db: Session, magic_token: str) -> OwnerSession:
    otp = db.scalar(select(OtpCode).where(OtpCode.magic_token == _hash(magic_token), OtpCode.consumed.is_(False)))
    if otp is None or datetime.now(timezone.utc) > otp.expires_at:
        raise OtpInvalidError()

    otp.consumed = True
    db.flush()
    account = db.get(Account, otp.account_id)
    return _issue_session(db, account)


def _issue_session(db: Session, account: Account) -> OwnerSession:
    raw_token = secrets.token_urlsafe(32)
    session = OwnerSession(
        account_id=account.id,
        token=_hash(raw_token),
        expires_at=datetime.now(timezone.utc) + SESSION_DURATION,
    )
    db.add(session)
    db.flush()
    session.raw_token = raw_token  # transient, never persisted
    return session


def revoke_session(db: Session, token: str) -> None:
    session = db.scalar(select(OwnerSession).where(OwnerSession.token == _hash(token)))
    if session is not None:
        session.revoked = True
        db.flush()


def resolve_session(db: Session, token: str) -> Account | None:
    session = db.scalar(select(OwnerSession).where(OwnerSession.token == _hash(token)))
    if session is None or session.revoked:
        return None
    if datetime.now(timezone.utc) > session.expires_at:
        return None
    return db.get(Account, session.account_id)
