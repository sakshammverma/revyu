"""Image uploads: re-encoded to WebP (strips EXIF/GPS, bounds size) and stored
on local disk in dev. Swap `save_image` internals for S3/R2 in production; the
returned value is a URL path and nothing else depends on where it lives."""
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 1000


class ImageError(ValueError):
    pass


def save_image(data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise ImageError("Image is larger than 5MB")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageError("That file isn't a readable image") from exc
    img = img.convert("RGBA" if img.mode in ("RGBA", "LA", "P") else "RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.webp"
    img.save(UPLOAD_DIR / name, format="WEBP", quality=78, method=4)
    return f"/uploads/{name}"
