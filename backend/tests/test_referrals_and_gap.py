import uuid

from app.models.payment import Payment
from app.models.referral import ReferralReward
from app.models.subscription import Subscription
from app.services import referrals
from app.services.billing import record_payment
from app.services.gap_report import build_report

from .conftest import make_account


def _sub(db, account) -> Subscription:
    sub = Subscription(id=uuid.uuid4(), account_id=account.id, plan="monthly", status="active")
    db.add(sub)
    db.flush()
    return sub


def test_referral_code_is_stable_and_unambiguous(db):
    a = make_account(db)
    code = referrals.get_or_create_code(db, a)
    assert code == referrals.get_or_create_code(db, a)
    assert len(code) == 7 and not set(code) & set("01OIL")


def test_reward_only_earned_when_referee_actually_pays(db):
    referrer, referee = make_account(db, "r"), make_account(db, "e")
    code = referrals.get_or_create_code(db, referrer)
    assert referrals.attach_referral(db, referee, code.lower()) is True

    reward = db.query(ReferralReward).filter_by(referred_account_id=referee.id).one()
    assert reward.status == "pending" and reward.discount_percent == 70

    # An authorised-but-uncharged mandate / a pending payment is not "paid".
    sub = _sub(db, referee)
    record_payment(db, sub, provider_payment_id="pay_1", amount_minor=49900,
                   currency_code="INR", status="authorized", webhook_verified=False)
    db.refresh(reward)
    assert reward.status == "pending"

    # A later capture of the same payment earns it.
    record_payment(db, sub, provider_payment_id="pay_1", amount_minor=49900,
                   currency_code="INR", status="captured", webhook_verified=True)
    db.refresh(reward)
    assert reward.status == "earned" and reward.earned_at is not None
    assert db.query(Payment).filter_by(provider_payment_id="pay_1").count() == 1


def test_self_referral_and_unknown_codes_are_ignored(db):
    a = make_account(db)
    code = referrals.get_or_create_code(db, a)
    assert referrals.attach_referral(db, a, code) is False
    assert referrals.attach_referral(db, make_account(db), "NOPE123") is False
    assert referrals.attach_referral(db, make_account(db), None) is False


def test_rejected_referee_voids_reward(db):
    referrer, referee = make_account(db, "r"), make_account(db, "e")
    referrals.attach_referral(db, referee, referrals.get_or_create_code(db, referrer))
    referrals.void_reward(db, referee.id)
    reward = db.query(ReferralReward).filter_by(referred_account_id=referee.id).one()
    assert reward.status == "void"


def test_gap_report_local_shape():
    r = build_report("ChIJ_local_x")
    assert r.top_competitor.review_count == 180
    assert r.review_gap == 133
    assert r.rank_by_reviews == 4 and r.group_size == 4
    assert len(r.competitors) == 3
