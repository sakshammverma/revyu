"""v1 pricing seed. See documents/05-DATA-MODEL.md §3.9a.

Never hardcode prices in application code (FR-71) — this seeds the `plans`
table; the rest of the app reads from it.
"""

from app.core.db import SessionLocal
from app.models.plan import Plan

# code, country_code, currency_code, amount_minor, displays as
V1_PLANS = [
    ("monthly", "IN", "INR", 49_900),  # ₹499
    ("annual", "IN", "INR", 449_900),  # ₹4,499
]


def seed_plans() -> None:
    db = SessionLocal()
    try:
        for code, country_code, currency_code, amount_minor in V1_PLANS:
            exists = (
                db.query(Plan)
                .filter_by(code=code, country_code=country_code, active=True)
                .first()
            )
            if exists:
                continue
            db.add(
                Plan(
                    code=code,
                    country_code=country_code,
                    currency_code=currency_code,
                    amount_minor=amount_minor,
                    active=True,
                )
            )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
    print("Seeded plans.")
