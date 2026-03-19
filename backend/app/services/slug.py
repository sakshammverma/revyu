import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.outlet import Outlet

_ALPHABET = string.ascii_lowercase + string.digits


def generate_unique_slug(db: Session, length: int = 7) -> str:
    """6-8 chars, URL-safe, non-sequential (documents/05-DATA-MODEL.md §3.2)."""
    for _ in range(20):
        candidate = "".join(secrets.choice(_ALPHABET) for _ in range(length))
        exists = db.scalar(select(Outlet.id).where(Outlet.slug == candidate))
        if exists is None:
            return candidate
    raise RuntimeError("Could not generate a unique slug after 20 attempts")
