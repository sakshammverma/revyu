"""Creates one demo dental outlet for local development.

Not part of the v1 product — a dev convenience so the customer flow can be
exercised against a real outlet+tags without going through admin onboarding.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.core.db import SessionLocal
from app.models.account import Account
from app.models.outlet import Outlet
from app.seeds.tags import seed_tags_for_outlet

DEV_SLUG = "demo-dental"


def seed_dev_outlet() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Outlet).filter_by(slug=DEV_SLUG).first()
        if existing:
            print(f"Dev outlet already exists: /r/{DEV_SLUG}")
            return

        account = Account(
            id=uuid.uuid4(),
            owner_phone="+919999999999",
            owner_email="dev@revyu.local",
            owner_name="Dev Owner",
        )
        db.add(account)
        db.flush()

        outlet = Outlet(
            id=uuid.uuid4(),
            account_id=account.id,
            slug=DEV_SLUG,
            business_name="Smile Dental Care",
            vertical="dental",
            state="trial",
            source="admin",
            activated_at=datetime.now(timezone.utc) - timedelta(days=1),
            google_review_url="https://search.google.com/local/writereview?placeid=DEV_PLACE_ID",
            baseline_rating=4.3,
            baseline_review_count=47,
        )
        db.add(outlet)
        db.flush()

        seed_tags_for_outlet(db, outlet.id, "dental")
        db.commit()
        print(f"Seeded dev outlet: /r/{DEV_SLUG}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_dev_outlet()
