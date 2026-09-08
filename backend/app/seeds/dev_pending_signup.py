"""Simulates a completed signup (payment succeeded) for local dev/testing
the admin approval queue, without needing live Places/Razorpay keys.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.core.db import SessionLocal
from app.models.account import Account
from app.models.outlet import Outlet
from app.seeds.tags import seed_tags_for_outlet


def seed_pending_signup() -> None:
    db = SessionLocal()
    try:
        account = Account(
            id=uuid.uuid4(),
            owner_phone="+919876500000",
            owner_email="pending-owner@example.com",
            owner_name="Dr. Pending Owner",
        )
        db.add(account)
        db.flush()

        outlet = Outlet(
            id=uuid.uuid4(),
            account_id=account.id,
            slug=f"pending-{uuid.uuid4().hex[:10]}",
            business_name="Bright Smile Dental",
            vertical="dental",
            state="pending_approval",
            source="self_serve",
            submitted_at=datetime.now(timezone.utc) - timedelta(hours=26),  # aged-out on purpose
            google_place_id="ChIJ_dev_test_place_id",
            google_review_url="https://search.google.com/local/writereview?placeid=ChIJ_dev_test_place_id",
            place_verified=False,
            placement_confirmed=False,
        )
        db.add(outlet)
        db.flush()
        seed_tags_for_outlet(db, outlet.id, "dental")
        db.commit()
        print(f"Seeded pending_approval outlet: {outlet.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_pending_signup()
