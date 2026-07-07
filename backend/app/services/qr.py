"""QR generation (FR-37/38). SVG and PNG >= 1024px, high error correction —
receipts crease, fold, and smudge. Quiet zone preserved.
"""

import io

import qrcode
import qrcode.image.svg
from qrcode.constants import ERROR_CORRECT_H

from app.core.config import get_settings


def _flow_url(slug: str) -> str:
    # PUBLIC_FLOW_BASE_URL in .env — the real domain in production.
    return f"{get_settings().public_flow_base_url.rstrip('/')}/r/{slug}"


MIN_PNG_SIZE_PX = 1024


def generate_qr_png(slug: str) -> bytes:
    """PNG >= 1024px per side (FR-38). box_size is computed from the actual
    module count after fitting, since a fixed box_size doesn't guarantee a
    minimum output size across different data lengths / EC levels.
    """
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=4)
    qr.add_data(_flow_url(slug))
    qr.make(fit=True)

    modules_per_side = qr.modules_count + 2 * qr.border
    box_size = -(-MIN_PNG_SIZE_PX // modules_per_side)  # ceil division

    qr.box_size = box_size
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_qr_svg(slug: str) -> bytes:
    qr = qrcode.QRCode(
        error_correction=ERROR_CORRECT_H,
        box_size=20,
        border=4,
        image_factory=qrcode.image.svg.SvgPathImage,
    )
    qr.add_data(_flow_url(slug))
    qr.make(fit=True)
    img = qr.make_image()

    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue()
