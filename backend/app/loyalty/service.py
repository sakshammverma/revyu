"""Loyalty engine. Earning is by staff-confirmed visits only; there is no other
trigger and none can be configured (FR-101). Badge state is derived from the
append-only ledger (FR-110).
"""
import hashlib
import hmac
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.loyalty import (
    LoyaltyBadge,
    LoyaltyLedger,
    LoyaltyMember,
    LoyaltyProgram,
    LoyaltyReward,
    LoyaltyRewardGrant,
    StaffPin,
)

CODE_WINDOW_SECONDS = 60
ICONS = ("sparkle", "heart", "crown", "gift", "flame", "gem", "leaf", "bolt")
REWARD_TYPES = ("percent_discount", "amount_discount", "freebie", "free_service")
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


class LoyaltyError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------- PINs

def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"{salt.hex()}${digest.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$")
        digest = hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
    except ValueError:
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


def find_pin(db: Session, outlet_id: uuid.UUID, pin: str) -> StaffPin | None:
    pins = db.scalars(
        select(StaffPin).where(StaffPin.outlet_id == outlet_id, StaffPin.active.is_(True))
    ).all()
    for row in pins:
        if verify_pin(pin, row.pin_hash):
            return row
    return None


def _sign(payload: str) -> str:
    key = get_settings().auth_secret.encode()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def make_staff_token(outlet_id: uuid.UUID, pin_id: uuid.UUID, hours: int = 8) -> str:
    exp = int(time.time()) + hours * 3600
    payload = f"{outlet_id}.{pin_id}.{exp}"
    return f"{payload}.{_sign(payload)}"


def read_staff_token(token: str) -> tuple[uuid.UUID, uuid.UUID] | None:
    try:
        outlet_s, pin_s, exp_s, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(f"{outlet_s}.{pin_s}.{exp_s}")):
            return None
        if int(exp_s) < time.time():
            return None
        return uuid.UUID(outlet_s), uuid.UUID(pin_s)
    except ValueError:
        return None


# ---------------------------------------------------------------- codes

def _window(offset: int = 0) -> int:
    return int(time.time() // CODE_WINDOW_SECONDS) + offset


def _code_for(secret: str, window: int) -> str:
    mac = hmac.new(secret.encode(), str(window).encode(), hashlib.sha256).digest()
    return f"{int.from_bytes(mac[:4], 'big') % 1_000_000:06d}"


def visit_code(member: LoyaltyMember) -> dict:
    """What the customer shows at the counter: MEMBERID-123456, valid ~60-120s."""
    remaining = CODE_WINDOW_SECONDS - int(time.time()) % CODE_WINDOW_SECONDS
    return {
        "code": f"{member.public_id}-{_code_for(member.code_secret, _window())}",
        "expires_in": remaining,
    }


def _new_public_id(db: Session, outlet_id: uuid.UUID) -> str:
    for _ in range(20):
        pid = "".join(secrets.choice(_ALPHABET) for _ in range(4))
        taken = db.scalar(
            select(LoyaltyMember.id).where(
                LoyaltyMember.outlet_id == outlet_id, LoyaltyMember.public_id == pid
            )
        )
        if taken is None:
            return pid
    raise LoyaltyError("ID_EXHAUSTED", "Could not allocate a member id")


# ---------------------------------------------------------------- members

def normalize_phone(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits  # launch market default; international numbers pass through
    if not 8 <= len(digits) <= 15:
        raise LoyaltyError("BAD_PHONE", "Enter a valid phone number")
    return digits


def join(db: Session, outlet_id: uuid.UUID, name: str, phone: str, consent: bool) -> tuple[LoyaltyMember, str]:
    name = name.strip()
    if not 1 <= len(name) <= 80:
        raise LoyaltyError("BAD_NAME", "Enter your name")
    phone = normalize_phone(phone)
    existing = db.scalar(
        select(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id,
            LoyaltyMember.phone == phone,
            LoyaltyMember.deleted_at.is_(None),
        )
    )
    if existing is not None:
        # No OTP yet (planned), so a phone number alone must not hand over a wallet.
        raise LoyaltyError(
            "PHONE_EXISTS",
            "This number already has a wallet on another device. Ask the staff for a transfer code.",
        )
    token = secrets.token_urlsafe(24)
    member = LoyaltyMember(
        outlet_id=outlet_id,
        public_id=_new_public_id(db, outlet_id),
        name=name,
        phone=phone,
        device_token_hash=hash_token(token),
        code_secret=secrets.token_hex(16),
        contact_consent=consent,
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise LoyaltyError("PHONE_EXISTS", "This number already has a wallet.")
    return member, token


TRANSFER_MINUTES = 15


def issue_transfer_code(db: Session, outlet_id: uuid.UUID, public_id: str) -> dict:
    """Staff-issued one-time code to move a wallet to a new phone. Staff see
    the member in person, so this stands in for SMS verification."""
    member = find_member_by_ref(db, outlet_id, public_id)
    if member is None:
        raise LoyaltyError("NOT_FOUND", "No such member.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    member.transfer_hash = hash_token(f"{member.id}:{code}")
    member.transfer_expires_at = _now() + timedelta(minutes=TRANSFER_MINUTES)
    db.commit()
    return {"code": code, "member": member.name, "valid_minutes": TRANSFER_MINUTES}


def claim_transfer(db: Session, outlet_id: uuid.UUID, phone: str, code: str) -> tuple[LoyaltyMember, str]:
    member = db.scalar(
        select(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id,
            LoyaltyMember.phone == normalize_phone(phone),
            LoyaltyMember.deleted_at.is_(None),
        )
    )
    expires = _aware(member.transfer_expires_at) if member else None
    good = (
        member is not None
        and member.transfer_hash is not None
        and expires is not None
        and expires > _now()
        and hmac.compare_digest(member.transfer_hash, hash_token(f"{member.id}:{code.strip()}"))
    )
    if not good:
        raise LoyaltyError("BAD_TRANSFER", "That code isn't valid or has expired. Ask the staff for a new one.")
    token = secrets.token_urlsafe(24)
    member.device_token_hash = hash_token(token)  # the old device is signed out
    member.transfer_hash = None
    member.transfer_expires_at = None
    db.commit()
    return member, token


def member_by_token(db: Session, outlet_id: uuid.UUID, token: str) -> LoyaltyMember | None:
    return db.scalar(
        select(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id,
            LoyaltyMember.device_token_hash == hash_token(token),
            LoyaltyMember.deleted_at.is_(None),
        )
    )


def delete_member(db: Session, member: LoyaltyMember) -> None:
    """FR-109: remove the member and every ledger/grant row."""
    db.query(LoyaltyRewardGrant).filter(LoyaltyRewardGrant.member_id == member.id).delete()
    db.query(LoyaltyLedger).filter(LoyaltyLedger.member_id == member.id).delete()
    db.delete(member)
    db.commit()


# ---------------------------------------------------------------- visits & rewards

def _program(db: Session, outlet_id: uuid.UUID) -> LoyaltyProgram:
    prog = db.get(LoyaltyProgram, outlet_id)
    if prog is None:
        prog = LoyaltyProgram(outlet_id=outlet_id)
        db.add(prog)
        db.flush()
    return prog


def visit_count(db: Session, member_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(LoyaltyLedger).where(
            LoyaltyLedger.member_id == member_id, LoyaltyLedger.kind == "visit"
        )
    ) or 0


def record_visit(db: Session, outlet_id: uuid.UUID, pin_id: uuid.UUID, combined: str) -> dict:
    try:
        public_id, code = combined.strip().upper().replace(" ", "").split("-")
    except ValueError:
        raise LoyaltyError("BAD_CODE", "Enter the code like A7F3-123456")
    member = db.scalar(
        select(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id,
            LoyaltyMember.public_id == public_id,
            LoyaltyMember.deleted_at.is_(None),
        )
    )
    valid = member is not None and any(
        hmac.compare_digest(code, _code_for(member.code_secret, _window(o))) for o in (0, -1)
    )
    if not valid:
        raise LoyaltyError("BAD_CODE", "Code not recognised or expired. Ask them to refresh.")

    prog = _program(db, outlet_id)
    last = db.scalar(
        select(func.max(LoyaltyLedger.created_at)).where(
            LoyaltyLedger.member_id == member.id, LoyaltyLedger.kind == "visit"
        )
    )
    last = _aware(last)
    if last is not None and _now() - last < timedelta(hours=prog.cooldown_hours):
        raise LoyaltyError("COOLDOWN", "Visit already recorded recently.")

    db.add(LoyaltyLedger(member_id=member.id, kind="visit", staff_pin_id=pin_id))
    db.flush()
    total = visit_count(db, member.id)

    earned: list[str] = []
    badges = db.scalars(
        select(LoyaltyBadge)
        .where(LoyaltyBadge.outlet_id == outlet_id, LoyaltyBadge.active.is_(True),
               LoyaltyBadge.visits_required <= total)
        .order_by(LoyaltyBadge.visits_required)
    ).all()
    for badge in badges:
        already = db.scalar(
            select(LoyaltyLedger.id).where(
                LoyaltyLedger.member_id == member.id,
                LoyaltyLedger.kind == "badge_awarded",
                LoyaltyLedger.ref_id == badge.id,
            )
        )
        if already is not None:
            continue
        db.add(LoyaltyLedger(member_id=member.id, kind="badge_awarded", ref_id=badge.id,
                             staff_pin_id=pin_id))
        earned.append(badge.name)
        reward = db.scalar(select(LoyaltyReward).where(LoyaltyReward.badge_id == badge.id))
        if reward is not None:
            grant = LoyaltyRewardGrant(
                member_id=member.id,
                reward_id=reward.id,
                redeem_code="".join(secrets.choice(_ALPHABET) for _ in range(8)),
                expires_at=_now() + timedelta(days=reward.expires_days) if reward.expires_days else None,
            )
            db.add(grant)
            db.flush()
            db.add(LoyaltyLedger(member_id=member.id, kind="reward_issued", ref_id=grant.id))
    db.commit()

    pending = open_grants(db, member.id)
    return {
        "member": {"public_id": member.public_id, "name": member.name},
        "visits": total,
        "badges_earned": earned,
        "rewards_ready": [g["title"] for g in pending],
        "pending_rewards": pending,
    }


def open_grants(db: Session, member_id: uuid.UUID) -> list[dict]:
    rows = db.execute(
        select(LoyaltyRewardGrant, LoyaltyReward)
        .join(LoyaltyReward, LoyaltyReward.id == LoyaltyRewardGrant.reward_id)
        .where(LoyaltyRewardGrant.member_id == member_id)
        .order_by(LoyaltyRewardGrant.issued_at.desc())
    ).all()
    out = []
    now = _now()
    for grant, reward in rows:
        expires = _aware(grant.expires_at)
        status = "used" if grant.redeemed_at else ("expired" if expires and expires < now else "available")
        out.append({
            "id": str(grant.id),
            "title": reward.title,
            "terms": reward.terms,
            "type": reward.type,
            "percent": reward.percent,
            "value_minor": reward.value_minor,
            "currency_code": reward.currency_code,
            "redeem_code": grant.redeem_code,
            "expires_at": expires.isoformat() if expires else None,
            "status": status,
        })
    return out


def find_member_by_ref(db: Session, outlet_id: uuid.UUID, public_id: str) -> LoyaltyMember | None:
    return db.scalar(
        select(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id,
            LoyaltyMember.public_id == public_id.strip().upper(),
            LoyaltyMember.deleted_at.is_(None),
        )
    )


def redeem(db: Session, outlet_id: uuid.UUID, pin_id: uuid.UUID, redeem_code: str) -> dict:
    code = redeem_code.strip().upper()
    row = db.execute(
        select(LoyaltyRewardGrant, LoyaltyReward, LoyaltyMember)
        .join(LoyaltyReward, LoyaltyReward.id == LoyaltyRewardGrant.reward_id)
        .join(LoyaltyMember, LoyaltyMember.id == LoyaltyRewardGrant.member_id)
        .where(LoyaltyRewardGrant.redeem_code == code, LoyaltyMember.outlet_id == outlet_id)
    ).first()
    if row is None:
        raise LoyaltyError("BAD_REWARD", "Reward code not found")
    grant, reward, member = row
    expires = _aware(grant.expires_at)
    if expires is not None and expires < _now():
        raise LoyaltyError("EXPIRED", "This reward has expired")
    # Single conditional UPDATE: double redemption is impossible (FR-106).
    burned = db.execute(
        update(LoyaltyRewardGrant)
        .where(LoyaltyRewardGrant.id == grant.id, LoyaltyRewardGrant.redeemed_at.is_(None))
        .values(redeemed_at=_now(), redeemed_by_pin_id=pin_id)
    )
    if burned.rowcount != 1:
        db.rollback()
        raise LoyaltyError("ALREADY_USED", "This reward was already redeemed")
    db.add(LoyaltyLedger(member_id=member.id, kind="reward_redeemed", ref_id=grant.id,
                         staff_pin_id=pin_id))
    db.commit()
    return {"title": reward.title, "member": member.name, "public_id": member.public_id}


# ---------------------------------------------------------------- wallet view

def wallet(db: Session, member: LoyaltyMember, outlet_id: uuid.UUID) -> dict:
    total = visit_count(db, member.id)
    badges = db.scalars(
        select(LoyaltyBadge)
        .where(LoyaltyBadge.outlet_id == outlet_id, LoyaltyBadge.active.is_(True))
        .order_by(LoyaltyBadge.visits_required)
    ).all()
    earned_ids = set(
        db.scalars(
            select(LoyaltyLedger.ref_id).where(
                LoyaltyLedger.member_id == member.id, LoyaltyLedger.kind == "badge_awarded"
            )
        ).all()
    )
    rewards = {
        r.badge_id: r
        for r in db.scalars(select(LoyaltyReward).where(LoyaltyReward.badge_id.in_([b.id for b in badges])))
    } if badges else {}
    shelf = [
        {
            "id": str(b.id),
            "name": b.name,
            "icon": b.icon,
            "visits_required": b.visits_required,
            "earned": b.id in earned_ids,
            "reward_title": rewards[b.id].title if b.id in rewards else None,
        }
        for b in badges
    ]
    nxt = next((b for b in badges if b.id not in earned_ids and b.visits_required > total), None)
    return {
        "member": {"public_id": member.public_id, "name": member.name},
        "visits": total,
        "next_badge": (
            {"name": nxt.name, "visits_required": nxt.visits_required, "remaining": nxt.visits_required - total}
            if nxt else None
        ),
        "badges": shelf,
        "rewards": open_grants(db, member.id),
    }


# ---------------------------------------------------------------- owner stats

def stats(db: Session, outlet_id: uuid.UUID) -> dict:
    since = _now() - timedelta(days=30)
    member_ids = select(LoyaltyMember.id).where(LoyaltyMember.outlet_id == outlet_id)

    def count(kind: str, recent: bool = False) -> int:
        q = select(func.count()).select_from(LoyaltyLedger).where(
            LoyaltyLedger.member_id.in_(member_ids), LoyaltyLedger.kind == kind
        )
        if recent:
            q = q.where(LoyaltyLedger.created_at >= since)
        return db.scalar(q) or 0

    members = db.scalar(
        select(func.count()).select_from(LoyaltyMember).where(
            LoyaltyMember.outlet_id == outlet_id, LoyaltyMember.deleted_at.is_(None)
        )
    ) or 0
    return {
        "members": members,
        "visits_30d": count("visit", True),
        "visits_total": count("visit"),
        "badges_awarded": count("badge_awarded"),
        "rewards_issued": count("reward_issued"),
        "rewards_redeemed": count("reward_redeemed"),
    }


def member_rows(db: Session, outlet_id: uuid.UUID, limit: int = 500) -> list[dict]:
    """Owner-facing member list: name, phone, visits (decision 2026-10-01)."""
    rows = db.execute(
        select(
            LoyaltyMember,
            func.count(LoyaltyLedger.id).filter(LoyaltyLedger.kind == "visit"),
            func.max(LoyaltyLedger.created_at).filter(LoyaltyLedger.kind == "visit"),
        )
        .outerjoin(LoyaltyLedger, LoyaltyLedger.member_id == LoyaltyMember.id)
        .where(LoyaltyMember.outlet_id == outlet_id, LoyaltyMember.deleted_at.is_(None))
        .group_by(LoyaltyMember.id)
        .order_by(LoyaltyMember.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": str(m.id),
            "public_id": m.public_id,
            "name": m.name,
            "phone": m.phone,
            "contact_consent": m.contact_consent,
            "visits": visits,
            "last_visit": last.isoformat() if last else None,
            "joined_at": m.created_at.isoformat(),
        }
        for m, visits, last in rows
    ]


def redemption_log(db: Session, outlet_id: uuid.UUID, limit: int = 100) -> list[dict]:
    rows = db.execute(
        select(LoyaltyRewardGrant, LoyaltyReward, LoyaltyMember)
        .join(LoyaltyReward, LoyaltyReward.id == LoyaltyRewardGrant.reward_id)
        .join(LoyaltyMember, LoyaltyMember.id == LoyaltyRewardGrant.member_id)
        .where(LoyaltyMember.outlet_id == outlet_id, LoyaltyRewardGrant.redeemed_at.is_not(None))
        .order_by(LoyaltyRewardGrant.redeemed_at.desc())
        .limit(limit)
    ).all()
    return [
        {"title": r.title, "member": m.name, "public_id": m.public_id,
         "redeemed_at": g.redeemed_at.isoformat()}
        for g, r, m in rows
    ]
