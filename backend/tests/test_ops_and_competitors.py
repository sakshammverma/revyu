import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.admin_auth import require_admin
from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.jobs.payment_grace_reminders import run_payment_grace_reminders
from app.jobs.zero_scan_alert import run_zero_scan_nudges
from app.main import app
from app.models.event import Event
from app.models.notification import Notification
from app.models.subscription import Subscription
from app.services import competitors
from app.services.notifications import notify
from app.services.places import _expand_short_link, _is_allowed_maps_url

from .conftest import make_account, make_outlet


@pytest.fixture()
def client(db):
    holder = {}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[get_current_owner] = lambda: holder["owner"]
    c = TestClient(app)
    c.holder = holder
    yield c
    app.dependency_overrides.clear()


# ── SSRF ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "url,ok",
    [
        ("https://maps.app.goo.gl/abc", True),
        ("https://www.google.com/maps/place/x", True),
        ("http://maps.app.goo.gl/abc", False),  # not https
        ("https://169.254.169.254/latest/meta-data", False),
        ("http://localhost:8000/admin", False),
        ("https://evil.example.com/?u=maps.google.com", False),
        ("https://maps.google.com.evil.com/", False),
    ],
)
def test_maps_url_allowlist(url, ok):
    assert _is_allowed_maps_url(url) is ok


def test_resolver_never_fetches_off_google_hosts(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("must not fetch")

    monkeypatch.setattr("app.services.places.httpx.get", boom)
    assert _expand_short_link("http://169.254.169.254/x") == "http://169.254.169.254/x"


# ── Competitor Watch ──────────────────────────────────────────────────────
def test_watch_limit_dupes_and_self(db):
    outlet = make_outlet(db, make_account(db))
    outlet.google_place_id = "ChIJ_me"
    db.flush()
    with pytest.raises(competitors.WatchError, match="CANNOT_WATCH_SELF"):
        competitors.add_watch(db, outlet, "ChIJ_me", "Me")
    competitors.add_watch(db, outlet, "p1", "Rival 1")
    with pytest.raises(competitors.WatchError, match="ALREADY_WATCHING"):
        competitors.add_watch(db, outlet, "p1", "Rival 1")
    competitors.add_watch(db, outlet, "p2", "Rival 2")
    competitors.add_watch(db, outlet, "p3", "Rival 3")
    with pytest.raises(competitors.WatchError, match="LIMIT_REACHED"):
        competitors.add_watch(db, outlet, "p4", "Rival 4")


def test_delta_and_headline():
    me = competitors.Standing("Me", 4.5, 60, 6)
    assert "more than anyone" in competitors.headline(me, [competitors.Standing("A", 4.4, 100, 2)])
    assert "A gained 9" in competitors.headline(me, [competitors.Standing("A", 4.4, 100, 9)])
    assert competitors._delta([110, 100]) == 10
    assert competitors._delta([110]) is None


def test_competitor_api_roundtrip_and_ownership(client, db):
    a, b = make_account(db, "a"), make_account(db, "b")
    make_outlet(db, a)
    make_outlet(db, b)
    client.holder["owner"] = a
    r = client.post("/api/app/competitors", json={"place_id": "p-x", "name": "Rival X"})
    assert r.status_code == 201, r.text
    watch_id = r.json()["competitors"][0]["id"]
    assert r.json()["limit"] == 3

    client.holder["owner"] = b  # someone else cannot delete it
    assert client.delete(f"/api/app/competitors/{watch_id}").status_code == 404
    client.holder["owner"] = a
    assert client.delete(f"/api/app/competitors/{watch_id}").json()["competitors"] == []


# ── Pending sends ─────────────────────────────────────────────────────────
def test_high_value_notification_queues_whatsapp_tap(client, db):
    account = make_account(db)
    outlet = make_outlet(db, account)
    account.owner_phone = "+919876543210"
    db.flush()
    notify(db, account_id=account.id, outlet_id=outlet.id, to_email=account.owner_email,
           template="collection_paused", data={"business_name": "Test Clinic", "payment_link": "http://x/pay"})
    # A routine template must NOT be queued.
    notify(db, account_id=account.id, outlet_id=outlet.id, to_email=account.owner_email,
           template="first_scan", data={"business_name": "Test Clinic"})
    db.flush()

    items = [i for i in client.get("/api/admin/pending-sends").json() if i["business_name"] == "Test Clinic"]
    assert len(items) == 1
    assert items[0]["link"].startswith("https://wa.me/919876543210?text=")
    sid = items[0]["id"]
    assert client.post(f"/api/admin/pending-sends/{sid}/sent").status_code == 204
    assert all(i["id"] != sid for i in client.get("/api/admin/pending-sends").json())


# ── Jobs ──────────────────────────────────────────────────────────────────
def test_payment_grace_reminders_on_day_3_and_6_only(db):
    account = make_account(db)
    outlet = make_outlet(db, account, state="past_due")
    now = datetime.now(timezone.utc)
    sub = Subscription(id=uuid.uuid4(), account_id=account.id, plan="monthly", status="past_due",
                       grace_until=now + timedelta(days=7) - timedelta(days=3, hours=1))
    db.add(sub)
    db.flush()
    assert run_payment_grace_reminders(db) == 1
    assert run_payment_grace_reminders(db) == 0  # same day: no duplicate
    sub.grace_until = now + timedelta(days=7) - timedelta(days=2, hours=1)  # day 2
    db.query(Notification).filter_by(outlet_id=outlet.id).delete()
    db.flush()
    assert run_payment_grace_reminders(db) == 0


def test_zero_scan_nudge_sent_once(db):
    account = make_account(db)
    outlet = make_outlet(db, account, state="trial")
    outlet.activated_at = datetime.now(timezone.utc) - timedelta(days=8)
    db.flush()
    assert run_zero_scan_nudges(db) >= 1

    def emails(o):
        return db.query(Notification).filter_by(outlet_id=o.id, template="zero_scan_nudge", channel="email").count()

    assert emails(outlet) == 1
    run_zero_scan_nudges(db)
    assert emails(outlet) == 1
    # An outlet that has a scan is left alone.
    scanned = make_outlet(db, make_account(db), state="trial")
    scanned.activated_at = datetime.now(timezone.utc) - timedelta(days=8)
    db.add(Event(outlet_id=scanned.id, type="scan"))
    db.flush()
    run_zero_scan_nudges(db)
    assert emails(scanned) == 0


# ── Cockpit, detail, override ─────────────────────────────────────────────
def test_cockpit_bands():
    from app.api.admin_ops import band_for

    assert band_for(None)[0] == "unknown"
    assert band_for(0.04)[0] == "stop"
    assert band_for(0.07)[0] == "iterate"
    assert band_for(0.15)[0] == "fix"
    assert band_for(0.25)[0] == "push"


def test_cockpit_endpoint_and_outlet_detail(client, db):
    outlet = make_outlet(db, make_account(db), state="trial")
    outlet.activated_at = datetime.now(timezone.utc)
    db.add(Event(outlet_id=outlet.id, type="scan"))
    db.flush()
    data = client.get("/api/admin/metrics").json()
    mine = [o for o in data["outlets"] if o["outlet_id"] == str(outlet.id)][0]
    assert mine["scans"] == 1 and data["window_days"] == 30
    detail = client.get(f"/api/admin/outlets/{outlet.id}/detail").json()
    assert detail["business_name"] == "Test Clinic" and detail["scans_30d"] == 1


def test_state_override_needs_reason_and_valid_state(client, db):
    outlet = make_outlet(db, make_account(db), state="suspended")
    url = f"/api/admin/outlets/{outlet.id}/state"
    assert client.post(url, json={"state": "active", "reason": ""}).status_code == 422
    assert client.post(url, json={"state": "pending_payment", "reason": "nope nope"}).status_code == 400
    assert client.post(url, json={"state": "active", "reason": "comped for pilot"}).status_code == 204
    db.refresh(outlet)
    assert outlet.state == "active"
