"""Print assets (documents/09-DESIGN-BRIEF.md §5): receipt footer, handout
card, counter standee, counter sticker. All embed the QR and neutral,
compliant copy — never "leave us a 5-star review" (CR-4/CR-5).
"""

import io

from reportlab.lib.pagesizes import A5, A7
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.services.qr import generate_qr_png

COMPLIANT_PROMPT = "Scan to share your experience"

# receipt footer: thermal-printer-safe strip, narrow width
RECEIPT_WIDTH = 80 * mm
RECEIPT_HEIGHT = 60 * mm

# counter sticker: 100x100mm square
STICKER_SIZE = 100 * mm


def _draw_qr(c: canvas.Canvas, slug: str, x: float, y: float, size: float) -> None:
    png_bytes = generate_qr_png(slug)
    from reportlab.lib.utils import ImageReader

    img = ImageReader(io.BytesIO(png_bytes))
    c.drawImage(img, x, y, width=size, height=size, preserveAspectRatio=True)


def generate_receipt_footer(slug: str, business_name: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(RECEIPT_WIDTH, RECEIPT_HEIGHT))

    c.setFont("Helvetica", 8)
    c.drawCentredString(RECEIPT_WIDTH / 2, RECEIPT_HEIGHT - 10 * mm, COMPLIANT_PROMPT)

    qr_size = 35 * mm
    _draw_qr(c, slug, (RECEIPT_WIDTH - qr_size) / 2, 12 * mm, qr_size)

    c.setFont("Helvetica", 6)
    c.drawCentredString(RECEIPT_WIDTH / 2, 6 * mm, business_name)

    c.showPage()
    c.save()
    return buf.getvalue()


def generate_handout_card(slug: str, business_name: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A7)
    width, height = A7

    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, height - 15 * mm, business_name)

    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 22 * mm, COMPLIANT_PROMPT)

    qr_size = 40 * mm
    _draw_qr(c, slug, (width - qr_size) / 2, 15 * mm, qr_size)

    c.showPage()
    c.save()
    return buf.getvalue()


def generate_counter_standee(slug: str, business_name: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    width, height = A5

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 25 * mm, business_name)

    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 35 * mm, COMPLIANT_PROMPT)

    qr_size = 60 * mm
    _draw_qr(c, slug, (width - qr_size) / 2, 30 * mm, qr_size)

    c.showPage()
    c.save()
    return buf.getvalue()


def generate_counter_sticker(slug: str, business_name: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(STICKER_SIZE, STICKER_SIZE))

    c.setFont("Helvetica", 9)
    c.drawCentredString(STICKER_SIZE / 2, STICKER_SIZE - 10 * mm, COMPLIANT_PROMPT)

    qr_size = 60 * mm
    _draw_qr(c, slug, (STICKER_SIZE - qr_size) / 2, 20 * mm, qr_size)

    c.setFont("Helvetica", 7)
    c.drawCentredString(STICKER_SIZE / 2, 10 * mm, business_name)

    c.showPage()
    c.save()
    return buf.getvalue()
