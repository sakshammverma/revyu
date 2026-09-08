"""A dedicated account for exercising the OTP login flow repeatedly during
development without tripping the real per-account rate limit on shared seed
accounts.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.core.db import SessionLocal
from app.models.account import Account
from app.models.outlet import Outlet
from app.seeds.tags import seed_tags_for_outlet

TEST_EMAIL = "auth-test@example.com"


def seed_auth_test_account() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Account).filter_by(owner_email=TEST_EMAIL).first()
        if existing:
            print(f"Auth test account already exists: {TEST_EMAIL}")
            return

        account = Account(
            id=uuid.uuid4(),
            owner_phone="+919876511111",
            owner_email=TEST_EMAIL,
            owner_name="Auth Test Owner",
        )
        db.add(account)
        db.flush()

        outlet = Outlet(
            id=uuid.uuid4(),
            account_id=account.id,
            slug=f"auth-test-{uuid.uuid4().hex[:8]}",
            business_name="Auth Test Clinic",
            vertical="dental",
            state="trial",
            source="admin",
            activated_at=datetime.now(timezone.utc) - timedelta(days=1),
            place_verified=True,
            placement_confirmed=True,
        )
        db.add(outlet)
        db.flush()
        seed_tags_for_outlet(db, outlet.id, "dental")
        db.commit()
        print(f"Seeded auth test account: {TEST_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_auth_test_account()
