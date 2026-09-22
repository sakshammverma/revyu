import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.api.events import _is_plausible_completion
from app.core import ratelimit
from app.core.config import Settings
from app.models.event import Event
from app.models.session import CustomerSession
from app.services import owner_auth
from app.services.trial_metering import MAX_CREDITS_PER_HOUR, record_completed_flow

from .conftest import make_account, make_outlet


def test_production_boot_refuses_default_secrets():
    with pytest.raises(ValueError, match="Unsafe configuration"):
        Settings(environment="production", _env_file=None)


def test_local_boot_allows_defaults():
    assert Settings(environment="local", _env_file=None).is_local


def test_rate_limiter_blocks_after_limit():
    dep = ratelimit.rate_limit(f"t-{uuid.uuid4()}", 2, 60)

    class Req:
        headers: dict = {}
        client = type("C", (), {"host": "1.2.3.4"})()

    dep(Req())
    dep(Req())
    with pytest.raises(HTTPException) as exc:
        dep(Req())
    assert exc.value.status_code == 429


def test_session_token_stored_hashed_and_revocable(db):
    account = make_account(db)
    session = owner_auth._issue_session(db, account)
    raw = session.raw_token
    assert session.token != raw  # only the hash is persisted
    assert owner_auth.resolve_session(db, raw).id == account.id
    owner_auth.revoke_session(db, raw)
    assert owner_auth.resolve_session(db, raw) is None


def test_magic_link_is_hashed_and_single_use(db):
    account = make_account(db)
    _, magic = owner_auth.request_otp(db, account)
    session = owner_auth.verify_magic_link(db, magic)
    assert session.raw_token
    with pytest.raises(owner_auth.OtpInvalidError):
        owner_auth.verify_magic_link(db, magic)


def _session(db, outlet, *, age_s: int, device: str | None = None) -> CustomerSession:
    s = CustomerSession(
        id=uuid.uuid4(),
        outlet_id=outlet.id,
        device_hash=device or uuid.uuid4().hex,
        started_at=datetime.now(timezone.utc) - timedelta(seconds=age_s),
    )
    db.add(s)
    db.flush()
    return s


def test_bare_copy_tapped_earns_no_credit(db):
    outlet = make_outlet(db, make_account(db))
    s = _session(db, outlet, age_s=60)  # old enough, but never rated
    assert _is_plausible_completion(db, s) is False


def test_fresh_session_earns_no_credit(db):
    outlet = make_outlet(db, make_account(db))
    s = _session(db, outlet, age_s=1)
    db.add(Event(outlet_id=outlet.id, session_id=s.id, type="rating_selected"))
    db.flush()
    assert _is_plausible_completion(db, s) is False


def test_rated_aged_session_is_plausible(db):
    outlet = make_outlet(db, make_account(db))
    s = _session(db, outlet, age_s=30)
    db.add(Event(outlet_id=outlet.id, session_id=s.id, type="rating_selected"))
    db.flush()
    assert _is_plausible_completion(db, s) is True


def test_hourly_ceiling_stops_credit_burn(db):
    outlet = make_outlet(db, make_account(db))
    for _ in range(MAX_CREDITS_PER_HOUR + 4):
        record_completed_flow(db, outlet, _session(db, outlet, age_s=30))
    assert outlet.trial_flow_count == MAX_CREDITS_PER_HOUR


def test_same_device_counts_once_in_24h(db):
    outlet = make_outlet(db, make_account(db))
    record_completed_flow(db, outlet, _session(db, outlet, age_s=30, device="dev-1"))
    record_completed_flow(db, outlet, _session(db, outlet, age_s=30, device="dev-1"))
    assert outlet.trial_flow_count == 1


def test_credit_milestones_email_once_and_suspend_at_ten(db):
    from app.models.notification import Notification

    outlet = make_outlet(db, make_account(db), state="locked")
    outlet.trial_flow_count = 16  # 6 credits used since the lock
    outlet.locked_at_flow_count = 10
    db.flush()

    def count(template):
        return db.query(Notification).filter_by(outlet_id=outlet.id, template=template, channel="email").count()

    record_completed_flow(db, outlet, _session(db, outlet, age_s=30))  # 7 used, 3 left
    assert count("credits_low") == 1 and outlet.state == "locked"
    record_completed_flow(db, outlet, _session(db, outlet, age_s=30))  # 8 used, 2 left
    assert count("credits_low") == 1  # not re-sent

    # Hourly ceiling applies, so space the remaining completions out in time.
    for s_ in db.query(CustomerSession).filter_by(outlet_id=outlet.id):
        s_.completed_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.flush()
    record_completed_flow(db, outlet, _session(db, outlet, age_s=30))  # 9
    record_completed_flow(db, outlet, _session(db, outlet, age_s=30))  # 10 -> suspended
    assert outlet.state == "suspended"
    assert count("collection_paused") == 1


def test_day15_lock_sends_trial_threshold_once(db):
    from datetime import timedelta as td

    from app.jobs.trial_day15_check import run_trial_day15_check
    from app.models.notification import Notification

    account = make_account(db)
    outlet = make_outlet(db, account, state="trial")
    outlet.activated_at = datetime.now(timezone.utc) - td(days=16)
    db.flush()
    run_trial_day15_check(db)
    run_trial_day15_check(db)
    db.refresh(outlet)
    assert outlet.state == "locked"
    assert db.query(Notification).filter_by(outlet_id=outlet.id, template="trial_threshold", channel="email").count() == 1
