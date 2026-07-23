"""Logo auto-fetch with a generated wordmark fallback (SRS-11.13,
documents/13-MULTI-TENANT.md §4.3). An outlet blocked on a logo is an outlet
that does not launch — the fallback must be good enough to ship.
"""

import io

from PIL import Image, ImageDraw, ImageFont

WORDMARK_SIZE = (600, 200)
PAPER_COLOR = (245, 245, 239)  # #F5F5EF, the design system's paper base
INK_COLOR = (40, 40, 40)  # #282828


def generate_wordmark(business_name: str) -> bytes:
    """A clean type-set business name on paper base — the documented v1
    fallback (09-DESIGN-BRIEF.md §6.1: 'a clean type-set wordmark is a fine
    v1 fallback'). No external font dependency — uses Pillow's default,
    since the actual Archivo font lives in the frontend, not this service.
    """
    img = Image.new("RGB", WORDMARK_SIZE, PAPER_COLOR)
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("arial.ttf", 48)
    except OSError:
        font = ImageFont.load_default()

    text = business_name.upper()
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (WORDMARK_SIZE[0] - text_width) / 2
    y = (WORDMARK_SIZE[1] - text_height) / 2

    draw.text((x, y), text, fill=INK_COLOR, font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def fetch_logo_or_fallback(business_name: str, website_url: str | None = None) -> bytes:
    """Attempts website favicon/og:image fetch; falls back to a generated
    wordmark. Google Business Profile photo fetch is not implemented here —
    it requires the Places Photos API (a separate billable endpoint beyond
    the basic search/details calls already wired), left as a documented gap
    rather than a silent no-op.
    """
    if website_url:
        og_image = _try_fetch_og_image(website_url)
        if og_image:
            return og_image

    return generate_wordmark(business_name)


def _try_fetch_og_image(website_url: str) -> bytes | None:
    import re

    import httpx

    try:
        resp = httpx.get(website_url, timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None

    match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        resp.text,
        re.IGNORECASE,
    )
    if not match:
        return None

    image_url = match.group(1)
    try:
        img_resp = httpx.get(image_url, timeout=8.0, follow_redirects=True)
        img_resp.raise_for_status()
        return img_resp.content
    except httpx.HTTPError:
        return None
