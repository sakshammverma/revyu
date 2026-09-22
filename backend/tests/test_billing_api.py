import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.main import app
from app.models.plan import Plan

from .conftest import make_account, make_outlet


@pytest.fixture()
def client(db):
    holder = {}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_owner] = lambda: holder["owner"]
    c = TestClient(app)
    c.holder = holder
    yield c
    app.dependency_overrides.clear()


def _seed_plans(db):
    for code, amt in (("monthly", 49900), ("annual", 449900)):
        if not db.query(Plan).filter_by(code=code, country_code="IN").first():
            db.add(Plan(id=uuid.uuid4(), code=code, country_code="IN",
                        currency_code="INR", amount_minor=amt, active=True))
    db.flush()


def test_locked_owner_sees_credits_and_can_pay_and_unlock(client, db):
    _seed_plans(db)
    owner = make_account(db)
    outlet = make_outlet(db, owner, state="locked")
    outlet.trial_flow_count = 14
    outlet.locked_at_flow_count = 10
    outlet.activated_at = datetime.now(timezone.utc)
    db.flush()
    client.holder["owner"] = owner

    status = client.get("/api/app/billing/status").json()
    assert status["state"] == "locked"
    assert status["credits_left"] == 6 and status["can_pay"] is True
    assert status["annual_saving_minor"] == 49900 * 12 - 449900

    resp = client.post("/api/app/billing/checkout", json={"plan": "monthly"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["checkout"]["trial_days"] == 0

    done = client.post(
        "/api/app/billing/confirm",
        json={"razorpay_payment_id": "pay_x", "razorpay_signature": "mock-signature",
              "razorpay_subscription_id": resp.json()["checkout"]["subscription_id"]},
    )
    assert done.status_code == 200, done.text
    assert done.json()["state"] == "active"


def test_bad_signature_does_not_unlock(client, db):
    _seed_plans(db)
    owner = make_account(db)
    make_outlet(db, owner, state="suspended")
    client.holder["owner"] = owner
    assert client.post("/api/app/billing/checkout", json={"plan": "annual"}).status_code == 201
    bad = client.post("/api/app/billing/confirm",
                      json={"razorpay_payment_id": "pay_y", "razorpay_signature": "forged"})
    assert bad.status_code == 400
    assert client.get("/api/app/billing/status").json()["state"] == "suspended"


def test_unknown_plan_rejected(client, db):
    _seed_plans(db)
    owner = make_account(db)
    make_outlet(db, owner, state="locked")
    client.holder["owner"] = owner
    assert client.post("/api/app/billing/checkout", json={"plan": "platinum"}).status_code == 400
