"""v1 pricing seed. See documents/05-DATA-MODEL.md §3.9a.

Never hardcode prices in application code (FR-71) — this seeds the `plans` and
`country_pricing` tables; the rest of the app reads from them.

Only the India prices are real. Every other amount below is a PLACEHOLDER for
the founder to replace from /admin/pricing before enabling that market.
"""

from app.core.db import SessionLocal
from app.models.plan import Plan
from sqlalchemy import text

# code, tier_code, currency_code, amount_minor
V1_PLANS = [
    ("monthly", "tier3", "INR", 49_900),  # ₹499
    ("annual", "tier3", "INR", 449_900),  # ₹4,499
    # placeholders ↓
    ("monthly", "tier2", "USD", 900),
    ("annual", "tier2", "USD", 8_100),
    ("monthly", "tier1", "USD", 1_900),
    ("annual", "tier1", "USD", 17_100),
    ("monthly", "tier1", "EUR", 1_800),
    ("annual", "tier1", "EUR", 16_200),
    ("monthly", "tier1", "GBP", 1_500),
    ("annual", "tier1", "GBP", 13_500),
]

# country_code, tier_code, currency_code, locale
COUNTRIES = [
    ("IN", "tier3", "INR", "en-IN"),
    ("*", "tier1", "USD", "en-US"),
    ("US", "tier1", "USD", "en-US"),
    ("CA", "tier1", "USD", "en-CA"),
    ("AU", "tier1", "USD", "en-AU"),
    ("NZ", "tier1", "USD", "en-NZ"),
    ("SG", "tier1", "USD", "en-SG"),
    ("AE", "tier1", "USD", "en-AE"),
    ("GB", "tier1", "GBP", "en-GB"),
    *[
        (c, "tier1", "EUR", loc)
        for c, loc in [
            ("DE", "de-DE"), ("FR", "fr-FR"), ("IT", "it-IT"), ("ES", "es-ES"),
            ("NL", "nl-NL"), ("IE", "en-IE"), ("BE", "nl-BE"), ("AT", "de-AT"),
            ("PT", "pt-PT"), ("FI", "fi-FI"),
        ]
    ],
    *[
        (c, "tier2", "USD", loc)
        for c, loc in [
            ("SA", "ar-SA"), ("QA", "ar-QA"), ("MY", "ms-MY"), ("TH", "th-TH"),
            ("ID", "id-ID"), ("BR", "pt-BR"), ("MX", "es-MX"), ("PL", "pl-PL"),
            ("ZA", "en-ZA"), ("TR", "tr-TR"),
        ]
    ],
]


def seed_plans() -> None:
    db = SessionLocal()
    try:
        for country, tier, currency, locale in COUNTRIES:
            db.execute(
                text(
                    "INSERT INTO country_pricing (country_code, tier_code, currency_code, locale) "
                    "VALUES (:c, :t, :cur, :l) ON CONFLICT (country_code) DO NOTHING"
                ),
                {"c": country, "t": tier, "cur": currency, "l": locale},
            )
        for code, tier, currency, amount_minor in V1_PLANS:
            exists = (
                db.query(Plan)
                .filter_by(code=code, tier_code=tier, currency_code=currency, active=True)
                .first()
            )
            if exists:
                continue
            db.add(
                Plan(
                    code=code,
                    tier_code=tier,
                    currency_code=currency,
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
