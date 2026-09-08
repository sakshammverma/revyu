"""Tag seed sets by vertical, loaded from app/verticals/*.json.

See documents/13-MULTI-TENANT.md §4.4 (SRS-11.14) — adding a vertical must be
a config change, not a code change. See documents/05-DATA-MODEL.md §7 for the
original seed content (now the source of app/verticals/*.json).

CR-1: each `phrases` entry is a short fragment mapping to exactly one
customer-selected attribute — never a full review sentence, never something
the customer did not select. >=4 phrase variants per locale (FR-57).

Applied at outlet creation (FR-36) and editable per outlet afterward.
"""

import json
from functools import lru_cache
from pathlib import Path

VERTICALS_DIR = Path(__file__).parent.parent / "verticals"

DEFAULT_VERTICAL = "dental"


@lru_cache
def list_verticals() -> list[str]:
    return sorted(p.stem for p in VERTICALS_DIR.glob("*.json"))


@lru_cache
def load_vertical_config(vertical: str) -> dict:
    path = VERTICALS_DIR / f"{vertical}.json"
    if not path.exists():
        path = VERTICALS_DIR / f"{DEFAULT_VERTICAL}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def seed_tags_for_outlet(db, outlet_id, vertical: str, locale: str = "en") -> list:
    """Create the default tag set for a newly created outlet.

    Called from outlet-creation flows (admin and self-serve), not standalone —
    tags are per-outlet (§3.3), unlike `plans` which is a shared reference table.
    """
    from app.models.tag import Tag

    config = load_vertical_config(vertical)
    created = []
    for sort_order, tag_def in enumerate(config["tags"]):
        tag = Tag(
            outlet_id=outlet_id,
            label={locale: tag_def["label"]},
            phrases={locale: tag_def["phrases"]},
            sort_order=sort_order,
            active=True,
        )
        db.add(tag)
        created.append(tag)
    return created
