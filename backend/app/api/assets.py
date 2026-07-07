import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.models.account import Account
from app.models.outlet import Outlet
from app.services.print_assets import (
    generate_counter_sticker,
    generate_counter_standee,
    generate_handout_card,
    generate_receipt_footer,
)
from app.services.qr import generate_qr_png, generate_qr_svg

router = APIRouter(prefix="/api/app/outlets", tags=["assets"])

_GENERATORS = {
    "receipt-footer": generate_receipt_footer,
    "handout-card": generate_handout_card,
    "counter-standee": generate_counter_standee,
    "counter-sticker": generate_counter_sticker,
}


def _get_own_outlet(db: Session, owner: Account, outlet_id: uuid.UUID) -> Outlet:
    outlet = db.get(Outlet, outlet_id)
    if outlet is None or outlet.account_id != owner.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN"}})
    if outlet.slug.startswith("pending-"):
        # No QR/print assets exist before approval (SRS-18.7).
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


@router.get("/{outlet_id}/qr")
def get_qr(
    outlet_id: uuid.UUID,
    format: str = "png",
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> Response:
    outlet = _get_own_outlet(db, owner, outlet_id)
    if format == "svg":
        return Response(content=generate_qr_svg(outlet.slug), media_type="image/svg+xml")
    return Response(content=generate_qr_png(outlet.slug), media_type="image/png")


@router.get("/{outlet_id}/print-assets/{asset}")
def get_print_asset(
    outlet_id: uuid.UUID,
    asset: str,
    owner: Account = Depends(get_current_owner),
    db: Session = Depends(get_db),
) -> Response:
    outlet = _get_own_outlet(db, owner, outlet_id)
    generator = _GENERATORS.get(asset)
    if generator is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})

    pdf_bytes = generator(outlet.slug, outlet.business_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{asset}-{outlet.slug}.pdf"'},
    )
