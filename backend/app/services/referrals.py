"""Owner referral programme.

The referrer gets 70% off their next invoice when a business they referred
actually PAYS - a signup, an approval or a started trial is not enough.
"Pays" means the first captured payment on the referred account, which is
hooked from services/billing.record_payment.

Incentive scope (compliance): this rewards owners for referring other owners.
It is never tied to a customer leaving a review (CR-5).
"""

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.referral import ReferralReward

DISCOUNT_PERCENT = 70
# Unambiguous alphabet: no 0/O/1/I/L.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(7))


def get_or_create_code(db: Session, account: Account) -> str:
    if account.referral_code:
        return account.referral_code
    for _ in range(5):
        code = _new_code()
        if db.scalar(select(Account.id).where(Account.referral_code == code)) is None:
            account.referral_code = code
            db.flush()
            return code
    raise RuntimeError("could not allocate a referral code")


def normalise_code(raw: str | None) -> str | None:
    if not raw:
        return None
    code = raw.strip().upper()
    return code or None


def attach_referral(db: Session, referred: Account, raw_code: str | None) -> bool:
    """Link a new account to its referrer. Silently ignores bad, self or
    repeated codes - a typo must never block a signup."""
    code = normalise_code(raw_code)
    if code is None or referred.referred_by_account_id is not None:
        return False
    referrer = db.scalar(select(Account).where(Account.referral_code == code))
    if referrer is None or referrer.id == referred.id:
        return False
    if referrer.owner_email.lower() == referred.owner_email.lower():
        return False
    referred.referred_by_account_id = referrer.id
    db.add(
        ReferralReward(
            id=uuid.uuid4(),
            referrer_account_id=referrer.id,
            referred_account_id=referred.id,
            status="pending",
            discount_percent=DISCOUNT_PERCENT,
        )
    )
    db.flush()
    return True


def mark_referee_paid(db: Session, referred_account_id: uuid.UUID) -> ReferralReward | None:
    """Called when the referred account's first payment is captured."""
    reward = db.scalar(
        select(ReferralReward).where(ReferralReward.referred_account_id == referred_account_id)
    )
    if reward is None or reward.status != "pending":
        return reward
    reward.status = "earned"
    reward.earned_at = datetime.now(timezone.utc)
    db.flush()
    return reward


def void_reward(db: Session, referred_account_id: uuid.UUID) -> None:
    """Referred signup was rejected/refunded before it ever paid for real."""
    reward = db.scalar(
        select(ReferralReward).where(ReferralReward.referred_account_id == referred_account_id)
    )
    if reward is not None and reward.status in ("pending", "earned"):
        reward.status = "void"
        db.flush()


def summary(db: Session, account: Account) -> dict:
    rows = db.execute(
        select(ReferralReward.status, func.count())
        .where(ReferralReward.referrer_account_id == account.id)
        .group_by(ReferralReward.status)
    ).all()
    counts = {status: n for status, n in rows}
    return {
        "pending": counts.get("pending", 0),
        "earned": counts.get("earned", 0),
        "applied": counts.get("applied", 0),
    }
