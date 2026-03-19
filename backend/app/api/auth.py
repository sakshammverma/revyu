from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.models.account import Account
from app.schemas.auth import AuthResponse, OtpRequestBody, OtpVerifyBody
from app.services.notifications import notify
from app.services.owner_auth import (
    OtpAttemptsExceededError,
    OtpInvalidError,
    OtpRateLimitedError,
    request_otp,
    revoke_session,
    verify_magic_link,
    verify_otp,
)

router = APIRouter(prefix="/api/app/auth", tags=["auth"])

SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days, seconds


def _set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        "session_token",
        raw_token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=not get_settings().is_local,
    )


@router.post(
    "/otp/request",
    status_code=204,
    dependencies=[Depends(rate_limit("otp_request", 10, 900))],
)
def otp_request(body: OtpRequestBody, db: Session = Depends(get_db)) -> None:
    account = db.scalar(select(Account).where(Account.owner_email == body.email))
    if account is None:
        # Do not leak whether an email is registered (SRS-15.2 posture).
        return

    try:
        code, magic_token = request_otp(db, account)
    except OtpRateLimitedError:
        # Same 204 as an unknown email - a 429 here would reveal that the
        # address is registered.
        return

    magic_link = f"{get_settings().frontend_base_url.rstrip('/')}/app/auth/magic?token={magic_token}"
    notify(
        db,
        account_id=account.id,
        outlet_id=None,
        to_email=account.owner_email,
        template="otp_login",
        data={"code": code, "magic_link": magic_link},
    )
    db.commit()


@router.post(
    "/otp/verify",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit("otp_verify", 20, 900))],
)
def otp_verify(body: OtpVerifyBody, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    account = db.scalar(select(Account).where(Account.owner_email == body.email))
    if account is None:
        raise HTTPException(status_code=400, detail={"error": {"code": "OTP_INVALID"}})

    try:
        session = verify_otp(db, account, body.code)
    except OtpAttemptsExceededError as exc:
        raise HTTPException(
            status_code=429, detail={"error": {"code": "OTP_ATTEMPTS_EXCEEDED"}}
        ) from exc
    except OtpInvalidError as exc:
        raise HTTPException(status_code=400, detail={"error": {"code": "OTP_INVALID"}}) from exc

    db.commit()
    _set_session_cookie(response, session.raw_token)
    return AuthResponse(session_token=session.raw_token, expires_at=session.expires_at.isoformat())


@router.get(
    "/magic",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit("magic", 20, 900))],
)
def magic_login(token: str, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        session = verify_magic_link(db, token)
    except OtpInvalidError as exc:
        raise HTTPException(status_code=400, detail={"error": {"code": "OTP_INVALID"}}) from exc

    db.commit()
    _set_session_cookie(response, session.raw_token)
    return AuthResponse(session_token=session.raw_token, expires_at=session.expires_at.isoformat())


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> None:
    if session_token:
        revoke_session(db, session_token)
        db.commit()
    response.delete_cookie("session_token")
