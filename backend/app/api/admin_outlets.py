import csv
import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.db import get_db
from app.models.account import Account
from app.models.outlet import Outlet
from app.models.tag import Tag
from app.schemas.admin_outlets import (
    ActivateOutletResponse,
    BulkImportResponse,
    BulkImportRow,
    CreateOutletRequest,
    CreateOutletResponse,
    OutletListItem,
    OutletListResponse,
    TagUpdateItem,
    UpdateTagsRequest,
    ValidateUrlRequest,
    ValidateUrlResponse,
)
from app.seeds.tags import list_verticals, seed_tags_for_outlet
from app.services.places import (
    AmbiguousPlaceError,
    PlacesUnavailableError,
    build_review_url,
    resolve_place_id,
)
from app.services.slug import generate_unique_slug

router = APIRouter(
    prefix="/api/admin/outlets", tags=["admin-outlets"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=OutletListResponse)
def list_outlets(
    state: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    source: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> OutletListResponse:
    # SRS-11.19 — filter by state, vertical, import batch (source stands in
    # for "batch" at v1; a real batch_id column is a later addition if bulk
    # volume ever needs finer grouping than source + created_at).
    query = select(Outlet)
    if state:
        query = query.where(Outlet.state == state)
    if vertical:
        query = query.where(Outlet.vertical == vertical)
    if source:
        query = query.where(Outlet.source == source)
    query = query.order_by(Outlet.created_at.desc())

    outlets = db.scalars(query).all()
    return OutletListResponse(
        items=[
            OutletListItem(
                outlet_id=o.id,
                business_name=o.business_name,
                vertical=o.vertical,
                state=o.state,
                source=o.source,
                created_at=o.created_at.isoformat(),
            )
            for o in outlets
        ]
    )


@router.get("/verticals")
def get_verticals() -> dict:
    # SRS-11.14 — verticals are config files; this just reflects what's on disk.
    return {"verticals": list_verticals()}


def _resolve_place_or_400(google_maps_url: str | None, place_id: str | None) -> str:
    if place_id:
        return place_id
    if not google_maps_url:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": "place_id or google_maps_url required"}},
        )
    try:
        return resolve_place_id(google_maps_url)
    except AmbiguousPlaceError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "AMBIGUOUS_PLACE",
                    "message": "Multiple matches found — resolve manually",
                    "candidates": [
                        {"place_id": c.place_id, "name": c.name, "address": c.address}
                        for c in exc.candidates
                    ],
                }
            },
        ) from exc
    except PlacesUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"error": {"code": "PLACES_UNAVAILABLE", "message": str(exc)}}
        ) from exc


@router.post("", response_model=CreateOutletResponse, status_code=201)
def create_outlet(body: CreateOutletRequest, db: Session = Depends(get_db)) -> CreateOutletResponse:
    # SRS-11.2 — manual single-outlet creation, admin path.
    place_id = _resolve_place_or_400(body.google_maps_url, body.place_id)

    account = db.scalar(select(Account).where(Account.owner_phone == body.owner_phone))
    if account is None:
        account = Account(
            id=uuid.uuid4(),
            owner_phone=body.owner_phone,
            owner_email=body.owner_email,
            owner_name=body.owner_name,
        )
        db.add(account)
        db.flush()

    outlet = Outlet(
        id=uuid.uuid4(),
        account_id=account.id,
        slug=generate_unique_slug(db),  # permanent: kept at activation
        business_name=body.business_name,
        vertical=body.vertical,
        google_place_id=place_id,
        google_review_url=build_review_url(place_id),
        state="draft",
        source="admin",
        place_verified=False,
        placement_confirmed=False,
    )
    db.add(outlet)
    db.flush()

    seed_tags_for_outlet(db, outlet.id, body.vertical)
    db.commit()

    return CreateOutletResponse(outlet_id=outlet.id, slug=outlet.slug, state=outlet.state)


@router.post("/{outlet_id}/validate-url", response_model=ValidateUrlResponse)
def validate_review_url(
    outlet_id: uuid.UUID, body: ValidateUrlRequest, db: Session = Depends(get_db)
) -> ValidateUrlResponse:
    # FR-35 — validated before activation. A full live check would fetch the
    # URL and confirm it resolves to Google's review form; here we validate
    # structurally (the write-review endpoint with a place_id param) since
    # actually rendering Google's page is out of scope for a sync request.
    valid = "search.google.com/local/writereview" in body.google_review_url and "placeid=" in body.google_review_url
    outlet = db.get(Outlet, outlet_id)
    if outlet is not None and valid:
        outlet.google_review_url = body.google_review_url
        db.commit()
    return ValidateUrlResponse(
        valid=valid, reason=None if valid else "URL does not match the expected Google review-write format"
    )


@router.put("/{outlet_id}/tags", status_code=204)
def update_tags(outlet_id: uuid.UUID, body: UpdateTagsRequest, db: Session = Depends(get_db)) -> None:
    # FR-36 — tag set defaults by vertical, editable per outlet.
    outlet = db.get(Outlet, outlet_id)
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})

    existing = {t.id: t for t in db.scalars(select(Tag).where(Tag.outlet_id == outlet_id)).all()}
    submitted_ids = set()

    item: TagUpdateItem
    for item in body.tags:
        if item.id and item.id in existing:
            tag = existing[item.id]
            tag.label = {"en": item.label}
            tag.phrases = {"en": item.phrases}
            tag.sort_order = item.sort_order
            tag.active = item.active
            submitted_ids.add(item.id)
        else:
            new_tag = Tag(
                outlet_id=outlet_id,
                label={"en": item.label},
                phrases={"en": item.phrases},
                sort_order=item.sort_order,
                active=item.active,
            )
            db.add(new_tag)

    # Tags omitted from the payload are deactivated, not deleted — event
    # history may reference their IDs (tags_selected.payload.tag_ids).
    for tag_id, tag in existing.items():
        if tag_id not in submitted_ids and tag_id not in {t.id for t in body.tags if t.id}:
            tag.active = False

    db.commit()


@router.post("/{outlet_id}/activate", response_model=ActivateOutletResponse)
def activate_outlet(outlet_id: uuid.UUID, db: Session = Depends(get_db)) -> ActivateOutletResponse:
    # FR-37/39, SRS-11.6/11.8, SRS-11.18/11.21 — activation stays per-outlet
    # and manual (never bulk), and is blocked without a real owner_email.
    outlet = db.get(Outlet, outlet_id)
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    # Self-serve signups go through /api/admin/approvals/{id}/approve, which
    # requires both SRS-19.3 checks explicitly — never this shortcut.
    if outlet.state != "draft":
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": f"cannot activate from state {outlet.state}"}},
        )
    if not outlet.google_review_url or not outlet.business_name:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": "review URL and business name required"}},
        )

    account = db.get(Account, outlet.account_id)
    if account is None or account.owner_email.startswith("placeholder-"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_FAILED",
                    "message": "a real owner_email is required before activation (SRS-11.21)",
                }
            },
        )

    active_tag_exists = db.scalar(
        select(Tag.id).where(Tag.outlet_id == outlet_id, Tag.active.is_(True)).limit(1)
    )
    if active_tag_exists is None:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "VALIDATION_FAILED", "message": "at least one active tag required"}},
        )

    # The slug is minted when the draft is created and never changes, so any
    # QR/print file downloaded for a prospecting demo keeps working once live
    # (C-6, SRS-12.9). Only legacy placeholder slugs are replaced.
    if outlet.slug.startswith(("draft-", "pending-")):
        outlet.slug = generate_unique_slug(db)
    outlet.state = "trial"
    outlet.activated_at = datetime.now(timezone.utc)
    outlet.place_verified = True
    outlet.placement_confirmed = True

    if outlet.google_place_id:
        from app.services.places import PlacesUnavailableError, get_place_snapshot

        try:
            rating, review_count = get_place_snapshot(outlet.google_place_id)
            outlet.baseline_rating = rating
            outlet.baseline_review_count = review_count
        except PlacesUnavailableError:
            pass

    db.commit()

    return ActivateOutletResponse(
        slug=outlet.slug,
        short_url=f"/r/{outlet.slug}",
        baseline_rating=outlet.baseline_rating,
        baseline_review_count=outlet.baseline_review_count,
        activated_at=outlet.activated_at.isoformat(),
    )


@router.post("/bulk", response_model=BulkImportResponse)
async def bulk_import(file: UploadFile, db: Session = Depends(get_db)) -> BulkImportResponse:
    """SRS-11.10 — CSV bulk import. Every row lands in `draft`; activation
    stays per-outlet and manual (§4.6). A partial failure never blocks the
    batch — each row reports its own status.
    """
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    rows: list[BulkImportRow] = []
    created = 0
    failed = 0

    for i, row in enumerate(reader, start=1):
        result = _import_row(db, i, row)
        rows.append(result)
        if result.status == "draft":
            created += 1
        else:
            failed += 1

    db.commit()
    return BulkImportResponse(created=created, failed=failed, rows=rows)


def _import_row(db: Session, row_num: int, row: dict) -> BulkImportRow:
    business_name = (row.get("business_name") or "").strip()
    vertical = (row.get("vertical") or "").strip()
    owner_phone = (row.get("owner_phone") or "").strip()
    owner_email = (row.get("owner_email") or "").strip()
    maps_url = (row.get("google_maps_url") or "").strip()

    if not business_name or not vertical or not owner_phone:
        return BulkImportRow(row=row_num, status="error", error="MISSING_REQUIRED_FIELD")

    # SRS-11.20 — rows without a real email are allowed for prospecting
    # imports (§4, "import with a placeholder, leave in draft") but the
    # placeholder must be unique so it never collides with accounts.owner_email's
    # unique constraint across a 50-row batch.
    if not owner_email:
        owner_email = f"placeholder-{uuid.uuid4().hex[:10]}@revyu.pending"
    else:
        dup = db.scalar(select(Account.id).where(Account.owner_email == owner_email))
        if dup is not None:
            return BulkImportRow(row=row_num, status="error", error="EMAIL_DUPLICATE")

    dup_phone = db.scalar(select(Account.id).where(Account.owner_phone == owner_phone))
    account = db.get(Account, dup_phone) if dup_phone else None
    if account is None:
        account = Account(
            id=uuid.uuid4(), owner_phone=owner_phone, owner_email=owner_email, owner_name=None
        )
        db.add(account)
        db.flush()

    place_id = None
    review_url = None
    if maps_url:
        try:
            place_id = resolve_place_id(maps_url)
            review_url = build_review_url(place_id)
        except AmbiguousPlaceError:
            return BulkImportRow(row=row_num, status="error", error="AMBIGUOUS_PLACE")
        except PlacesUnavailableError:
            return BulkImportRow(row=row_num, status="error", error="PLACE_ID_NOT_FOUND")

    outlet = Outlet(
        id=uuid.uuid4(),
        account_id=account.id,
        slug=generate_unique_slug(db),  # permanent: kept at activation
        business_name=business_name,
        vertical=vertical,
        google_place_id=place_id,
        google_review_url=review_url,
        state="draft",
        source="bulk_import",
        place_verified=False,
        placement_confirmed=False,
    )
    db.add(outlet)
    db.flush()
    seed_tags_for_outlet(db, outlet.id, vertical)

    return BulkImportRow(row=row_num, outlet_id=outlet.id, slug=outlet.slug, status="draft")
