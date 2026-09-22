import re
from pathlib import Path

import pytest

from app.loyalty import service as loyalty
from app.models.hub import MenuCategory, MenuItem, OutletLink
from app.models.loyalty import LoyaltyBadge, LoyaltyProgram, LoyaltyReward, StaffPin
from app.services import hub_config as hc
from app.services.links import LinkError, normalize_link

from .conftest import make_account, make_outlet


# ------------------------------------------------------------------ links

def test_link_normalisation_and_validation():
    assert normalize_link("whatsapp", "+91 98765 43210") == "https://wa.me/919876543210"
    assert normalize_link("instagram", "@mycafe") == "https://instagram.com/mycafe"
    assert normalize_link("phone", "tel:+91 98765-43210") == "tel:+919876543210"
    assert normalize_link("website", "http://example.com").startswith("https://")
    with pytest.raises(LinkError):
        normalize_link("instagram", "https://evil.com/x")
    with pytest.raises(LinkError):
        normalize_link("website", "javascript:alert(1)")
    with pytest.raises(LinkError):
        normalize_link("website", "https://revyu.in/r/x", own_hosts=("revyu.in",))


# ------------------------------------------------------------------ hub resolution

def test_hub_needs_two_modules_with_content(db):
    outlet = make_outlet(db, make_account(db))
    outlet.hub_mode = "menu"
    db.flush()
    assert hc.resolve_hub(db, outlet)["mode"] == "direct"  # only review

    # Enabling an empty module is refused (FR-89).
    with pytest.raises(hc.HubConfigError):
        hc.set_modules(db, outlet, [{"module": "review", "enabled": True},
                                    {"module": "connect", "enabled": True}])

    db.add(OutletLink(outlet_id=outlet.id, kind="website", url="https://example.com"))
    db.flush()
    hc.set_modules(db, outlet, [{"module": "review", "enabled": True},
                                {"module": "connect", "enabled": True}])
    resolved = hc.resolve_hub(db, outlet)
    assert resolved["mode"] == "hub"
    assert [m["key"] for m in resolved["modules"]] == ["review", "connect"]

    outlet.hub_mode = "direct"
    db.flush()
    assert hc.resolve_hub(db, outlet)["mode"] == "direct"


def test_unavailable_module_cannot_be_enabled_by_owner_only(db):
    outlet = make_outlet(db, make_account(db))
    cat = MenuCategory(outlet_id=outlet.id, name="Cleaning")
    db.add(cat)
    db.flush()
    db.add(MenuItem(category_id=cat.id, name="Scaling", price_on_request=True))
    db.flush()
    hc.set_availability(db, outlet, "menu", False)
    body = [{"module": "review", "enabled": True}, {"module": "menu", "enabled": True}]
    with pytest.raises(hc.HubConfigError):
        hc.set_modules(db, outlet, body)
    hc.set_modules(db, outlet, body, is_admin=True)


# ------------------------------------------------------------------ loyalty

def _program(db, outlet):
    db.add(LoyaltyProgram(outlet_id=outlet.id, cooldown_hours=12))
    badge = LoyaltyBadge(outlet_id=outlet.id, name="Regular", icon="sparkle", visits_required=2)
    db.add(badge)
    db.flush()
    db.add(LoyaltyReward(badge_id=badge.id, type="percent_discount", percent=10,
                         title="10% off", expires_days=30))
    pin = StaffPin(outlet_id=outlet.id, label="Desk", pin_hash=loyalty.hash_pin("1234"))
    db.add(pin)
    db.flush()
    return pin


def test_visit_badge_reward_and_single_redemption(db):
    outlet = make_outlet(db, make_account(db))
    pin = _program(db, outlet)
    member, token = loyalty.join(db, outlet.id, "Asha", "98765 43210", True)
    assert loyalty.member_by_token(db, outlet.id, token).id == member.id

    # Phone alone must not hand over an existing wallet.
    with pytest.raises(loyalty.LoyaltyError) as e:
        loyalty.join(db, outlet.id, "Someone else", "9876543210", False)
    assert e.value.code == "PHONE_EXISTS"

    with pytest.raises(loyalty.LoyaltyError):
        loyalty.record_visit(db, outlet.id, pin.id, f"{member.public_id}-000000")

    r1 = loyalty.record_visit(db, outlet.id, pin.id, loyalty.visit_code(member)["code"])
    assert r1["visits"] == 1 and r1["badges_earned"] == []

    # Cool-down: same member cannot farm visits.
    with pytest.raises(loyalty.LoyaltyError) as e:
        loyalty.record_visit(db, outlet.id, pin.id, loyalty.visit_code(member)["code"])
    assert e.value.code == "COOLDOWN"

    # Move the first visit out of the cool-down window, then second visit earns the badge.
    from datetime import timedelta
    from app.models.loyalty import LoyaltyLedger
    row = db.query(LoyaltyLedger).filter_by(member_id=member.id, kind="visit").one()
    row.created_at = row.created_at - timedelta(hours=13)
    db.flush()
    r2 = loyalty.record_visit(db, outlet.id, pin.id, loyalty.visit_code(member)["code"])
    assert r2["badges_earned"] == ["Regular"]
    code = r2["pending_rewards"][0]["redeem_code"]

    out = loyalty.redeem(db, outlet.id, pin.id, code)
    assert out["title"] == "10% off"
    with pytest.raises(loyalty.LoyaltyError) as e:
        loyalty.redeem(db, outlet.id, pin.id, code)
    assert e.value.code == "ALREADY_USED"

    stats = loyalty.stats(db, outlet.id)
    assert stats["members"] == 1 and stats["rewards_redeemed"] == 1
    rows = loyalty.member_rows(db, outlet.id)
    assert rows[0]["name"] == "Asha" and rows[0]["visits"] == 2  # owner sees details

    loyalty.delete_member(db, member)
    assert loyalty.stats(db, outlet.id)["members"] == 0


def test_other_outlets_codes_and_tokens_do_not_cross(db):
    a = make_outlet(db, make_account(db, "a"))
    b = make_outlet(db, make_account(db, "b"))
    pin_b = _program(db, b)
    member, token = loyalty.join(db, a.id, "Ravi", "9123456789", False)
    assert loyalty.member_by_token(db, b.id, token) is None
    with pytest.raises(loyalty.LoyaltyError):
        loyalty.record_visit(db, b.id, pin_b.id, loyalty.visit_code(member)["code"])


def test_staff_token_is_bound_to_outlet_and_tamper_proof(db):
    outlet = make_outlet(db, make_account(db))
    pin = _program(db, outlet)
    token = loyalty.make_staff_token(outlet.id, pin.id)
    assert loyalty.read_staff_token(token) == (outlet.id, pin.id)
    assert loyalty.read_staff_token(token[:-1] + ("0" if token[-1] != "0" else "1")) is None
    assert loyalty.read_staff_token("garbage") is None


# ------------------------------------------------------------------ CR-6

APP = Path(__file__).resolve().parent.parent / "app"
REVIEW_TERMS = re.compile(r"review|draft|feedback|\btags?\b|rating|google|stars?\b", re.I)
LOYALTY_FILES = [
    APP / "loyalty" / "service.py",
    APP / "models" / "loyalty.py",
    APP / "api" / "staff.py",
]


@pytest.mark.parametrize("path", LOYALTY_FILES, ids=lambda p: p.name)
def test_cr6_loyalty_code_never_mentions_review_side(path):
    hits = [ln for ln in path.read_text(encoding="utf-8").splitlines() if REVIEW_TERMS.search(ln)]
    assert not hits, f"CR-6: review-side term in {path.name}: {hits[:3]}"


def test_cr6_no_foreign_key_between_loyalty_and_review_tables():
    from app.core.db import Base
    import app.models  # noqa: F401

    loyalty_tables = {t for t in Base.metadata.tables if t.startswith(("loyalty_", "staff_"))}
    review_tables = {"sessions", "events", "private_feedback", "tags", "customer_sessions"}
    for name in loyalty_tables:
        for fk in Base.metadata.tables[name].foreign_keys:
            assert fk.column.table.name not in review_tables, f"{name} -> {fk.column.table.name}"
    for name in review_tables & set(Base.metadata.tables):
        for fk in Base.metadata.tables[name].foreign_keys:
            assert fk.column.table.name not in loyalty_tables


def test_wallet_transfer_needs_staff_code_single_use_and_signs_out_old_device(db):
    from datetime import timedelta

    outlet = make_outlet(db, make_account(db))
    _program(db, outlet)
    member, old_token = loyalty.join(db, outlet.id, "Meera", "9123400000", False)

    with pytest.raises(loyalty.LoyaltyError):
        loyalty.claim_transfer(db, outlet.id, "9123400000", "123456")  # none issued
    issued = loyalty.issue_transfer_code(db, outlet.id, member.public_id)
    with pytest.raises(loyalty.LoyaltyError):
        loyalty.claim_transfer(db, outlet.id, "9123400000", "000000" if issued["code"] != "000000" else "111111")

    claimed, new_token = loyalty.claim_transfer(db, outlet.id, "+91 91234 00000", issued["code"])
    assert claimed.id == member.id
    assert loyalty.member_by_token(db, outlet.id, old_token) is None
    assert loyalty.member_by_token(db, outlet.id, new_token).id == member.id
    with pytest.raises(loyalty.LoyaltyError):  # single use
        loyalty.claim_transfer(db, outlet.id, "9123400000", issued["code"])

    again = loyalty.issue_transfer_code(db, outlet.id, member.public_id)
    member.transfer_expires_at = member.transfer_expires_at - timedelta(minutes=30)
    db.flush()
    with pytest.raises(loyalty.LoyaltyError):  # expired
        loyalty.claim_transfer(db, outlet.id, "9123400000", again["code"])
