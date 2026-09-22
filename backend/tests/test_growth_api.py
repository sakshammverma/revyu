import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.main import app
from app.models.growth import ServiceCatalog

from .conftest import make_account, make_outlet


@pytest.fixture()
def client(db):
    owner = make_account(db, "g")
    outlet = make_outlet(db, owner)
    db.add(ServiceCatalog(key="t_website", name="Website", tagline="t", questions=[], deliverables=[]))
    db.flush()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_owner] = lambda: owner
    yield TestClient(app), outlet
    app.dependency_overrides.clear()


def admin():
    return {"Authorization": f"Bearer {get_settings().admin_session_secret}"}


def test_request_quote_accept_flow_and_internal_notes_stay_private(client):
    c, _ = client
    r = c.post("/api/app/service-requests", json={"service_key": "t_website", "brief": "Need a site", "answers": {"domain": "No"}})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]

    dup = c.post("/api/app/service-requests", json={"service_key": "t_website"})
    assert dup.status_code == 409  # one open request per service

    # A quote needs an amount first.
    bad = c.patch(f"/api/admin/service-requests/{rid}", headers=admin(), json={"status": "quoted"})
    assert bad.status_code == 422
    ok = c.patch(f"/api/admin/service-requests/{rid}", headers=admin(),
                 json={"quoted_amount_minor": 1_500_000, "status": "quoted", "note": "margin is thin", "message": "Here is your quote"})
    assert ok.status_code == 200, ok.text

    mine = c.get(f"/api/app/service-requests/{rid}").json()
    assert mine["status"] == "quoted" and mine["quoted_amount_minor"] == 1_500_000
    assert all(e["kind"] != "note" for e in mine["events"])  # internal note hidden from owner
    assert any(e["kind"] == "message" for e in mine["events"])
    assert any(e["kind"] == "note" for e in c.get(f"/api/admin/service-requests/{rid}", headers=admin()).json()["events"])

    assert c.post(f"/api/app/service-requests/{rid}/accept").json()["status"] == "accepted"
    assert c.post(f"/api/app/service-requests/{rid}/cancel").status_code == 409  # too late to cancel


def test_admin_routes_require_token(client):
    c, _ = client
    assert c.get("/api/admin/service-requests").status_code == 401
    assert c.get("/api/admin/services").status_code == 401


def test_print_kit_delivery_needs_address_and_charges_flat_fee(client):
    c, _ = client
    assert c.post("/api/app/print-kit", json={"method": "deliver"}).status_code == 422
    r = c.post("/api/app/print-kit", json={"method": "deliver", "address": "12 MG Road", "phone": "9876543210"})
    assert r.status_code == 201 and r.json()["fee_minor"] == 19_900
    own = c.post("/api/app/print-kit", json={"method": "self_print"})
    assert own.json()["fee_minor"] == 0


def _pay(c, start_path, confirm_path):
    start = c.post(start_path)
    assert start.status_code == 200, start.text
    info = start.json()
    assert info["order_id"] and info["amount_minor"] > 0
    bad = c.post(confirm_path, json={"razorpay_payment_id": "p", "razorpay_order_id": info["order_id"],
                                     "razorpay_signature": "wrong"})
    assert bad.status_code == 400  # signature must verify
    unknown = c.post(confirm_path, json={"razorpay_payment_id": "p", "razorpay_order_id": "order_nope",
                                         "razorpay_signature": "mock-signature"})
    assert unknown.status_code == 404
    ok = c.post(confirm_path, json={"razorpay_payment_id": "mock", "razorpay_order_id": info["order_id"],
                                    "razorpay_signature": "mock-signature"})
    assert ok.status_code == 200, ok.text
    return ok.json()


def test_quote_payment_uses_our_amount_and_verifies_signature(client):
    c, _ = client
    rid = c.post("/api/app/service-requests", json={"service_key": "t_website"}).json()["id"]
    assert c.post(f"/api/app/service-requests/{rid}/pay").status_code == 409  # not accepted yet
    c.patch(f"/api/admin/service-requests/{rid}", headers=admin(), json={"quoted_amount_minor": 500_000, "status": "quoted"})
    c.post(f"/api/app/service-requests/{rid}/accept")
    out = _pay(c, f"/api/app/service-requests/{rid}/pay", f"/api/app/service-requests/{rid}/pay/confirm")
    assert out["paid"] is True
    assert c.post(f"/api/app/service-requests/{rid}/pay").status_code == 409  # already paid


def test_print_kit_payment_marks_order_paid(client):
    c, _ = client
    kit = c.post("/api/app/print-kit", json={"method": "deliver", "address": "1 Road", "phone": "9876543210"}).json()
    out = _pay(c, f"/api/app/print-kit/{kit['id']}/pay", f"/api/app/print-kit/{kit['id']}/pay/confirm")
    assert out["status"] == "paid"
    self_print = c.post("/api/app/print-kit", json={"method": "self_print"}).json()
    assert c.post(f"/api/app/print-kit/{self_print['id']}/pay").status_code == 409


def test_hub_insights_counts_events_and_take_rate(client, db):
    from app.models.event import Event

    c, outlet = client
    for t, p in [("hub_viewed", {}), ("hub_viewed", {}), ("module_selected", {"module": "review"}),
                 ("link_clicked", {"kind": "whatsapp"}), ("menu_viewed", {})]:
        db.add(Event(outlet_id=outlet.id, type=t, payload=p))
    db.flush()
    d = c.get(f"/api/app/outlets/{outlet.id}/hub/insights").json()
    assert d["hub_views"] == 2 and d["take_rate"] == 0.5
    assert d["links"] == {"whatsapp": 1} and d["menu_views"] == 1
