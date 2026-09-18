import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.models.account import Account
from app.models.outlet import Outlet


@pytest.fixture()
def db():
    """A session wrapped in a transaction that is always rolled back, so tests
    never leave rows in the local dev database."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()


def make_account(db: Session, tag: str = "a") -> Account:
    n = uuid.uuid4().hex[:8]
    account = Account(
        id=uuid.uuid4(),
        owner_phone=f"+91{n}{tag}",
        owner_email=f"{tag}-{n}@example.com",
        owner_name=f"Owner {tag}",
    )
    db.add(account)
    db.flush()
    return account


def make_outlet(db: Session, account: Account, state: str = "trial") -> Outlet:
    outlet = Outlet(
        id=uuid.uuid4(),
        account_id=account.id,
        slug=f"t-{uuid.uuid4().hex[:10]}",
        business_name="Test Clinic",
        vertical="dental",
        state=state,
        source="admin",
    )
    db.add(outlet)
    db.flush()
    return outlet


@pytest.fixture(autouse=True)
def _mock_payments_in_tests(monkeypatch):
    """Keys in .env (e.g. Razorpay test keys for manual testing) must never
    make the suite call the real gateway: force the local mock."""
    from app.services.payments.razorpay_provider import RazorpayProvider

    monkeypatch.setattr(RazorpayProvider, "configured", property(lambda self: False))
