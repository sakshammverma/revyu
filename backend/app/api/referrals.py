import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.referral import ReferralReward
from app.services import referrals

router = APIRouter(tags=["referrals"])


class ReferralRow(BaseModel):
    business_name: str
    status: str  # pending | earned | applied | void
    created_at: str


class ReferralOverview(BaseModel):
    code: str
    link: str
    discount_percent: int
    pending: int
    earned: int
    applied: int
    referrals: list[ReferralRow]


@router.get("/api/app/referrals", response_model=ReferralOverview)
def my_referrals(
    owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)
) -> ReferralOverview:
    code = referrals.get_or_create_code(db, owner)
    db.commit()

    rows = db.execute(
        select(ReferralReward, Outlet.business_name)
        .join(Outlet, Outlet.account_id == ReferralReward.referred_account_id)
        .where(ReferralReward.referrer_account_id == owner.id)
        .order_by(ReferralReward.created_at.desc())
    ).all()
    counts = referrals.summary(db, owner)
    base = get_settings().frontend_base_url.rstrip("/")
    return ReferralOverview(
        code=code,
        link=f"{base}/signup?ref={code}",
        discount_percent=referrals.DISCOUNT_PERCENT,
        referrals=[
            ReferralRow(
                business_name=name,
                status=reward.status,
                created_at=reward.created_at.isoformat(),
            )
            for reward, name in rows
        ],
        **counts,
    )


class AdminReward(BaseModel):
    id: uuid.UUID
    referrer_email: str
    referrer_name: str | None
    referred_business: str
    status: str
    discount_percent: int
    earned_at: str | None


@router.get(
    "/api/admin/referrals",
    response_model=list[AdminReward],
    dependencies=[Depends(require_admin)],
)
def admin_list_rewards(status: str | None = None, db: Session = Depends(get_db)) -> list[AdminReward]:
    q = select(ReferralReward).order_by(ReferralReward.created_at.desc()).limit(200)
    if status:
        q = q.where(ReferralReward.status == status)
    return [_row(db, reward) for reward in db.scalars(q)]


@router.post(
    "/api/admin/referrals/{reward_id}/apply",
    response_model=AdminReward,
    dependencies=[Depends(require_admin)],
)
def admin_apply_reward(reward_id: uuid.UUID, db: Session = Depends(get_db)) -> AdminReward:
    """The founder applies the 70% discount to the referrer's next invoice in
    the payment dashboard, then marks it applied here (mandate amounts are
    fixed by the plan, so the discount is applied out-of-band at v1)."""
    reward = db.get(ReferralReward, reward_id)
    if reward is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND"}})
    if reward.status != "earned":
        raise HTTPException(status_code=409, detail={"error": {"code": "NOT_EARNED"}})
    reward.status = "applied"
    reward.applied_at = datetime.now(timezone.utc)
    db.commit()
    return _row(db, reward)


def _row(db: Session, reward: ReferralReward) -> AdminReward:
    referrer = db.get(Account, reward.referrer_account_id)
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == reward.referred_account_id))
    return AdminReward(
        id=reward.id,
        referrer_email=referrer.owner_email,
        referrer_name=referrer.owner_name,
        referred_business=outlet.business_name if outlet else "-",
        status=reward.status,
        discount_percent=reward.discount_percent,
        earned_at=reward.earned_at.isoformat() if reward.earned_at else None,
    )
