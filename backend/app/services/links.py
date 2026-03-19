"""Validation for owner-entered social/contact links (FR-90): https and tel
only, host must match the platform, never a redirect through our own domain."""
import re
from urllib.parse import quote, urlparse

LINK_KINDS = (
    "google_maps",
    "instagram",
    "facebook",
    "youtube",
    "whatsapp",
    "website",
    "phone",
    "email",
    "custom",
)

_HOSTS = {
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com", "fb.com", "fb.me"),
    "youtube": ("youtube.com", "youtu.be"),
    "google_maps": ("google.com", "maps.app.goo.gl", "goo.gl", "g.page", "maps.google.com"),
}


_NAMES = {
    "instagram": "an Instagram",
    "facebook": "a Facebook",
    "youtube": "a YouTube",
    "google_maps": "a Google Maps",
}


class LinkError(ValueError):
    pass


def google_maps_url(business_name: str, place_id: str | None) -> str:
    url = f"https://www.google.com/maps/search/?api=1&query={quote(business_name)}"
    if place_id:
        url += f"&query_place_id={quote(place_id)}"
    return url


def normalize_link(kind: str, raw: str, *, own_hosts: tuple[str, ...] = ()) -> str:
    value = (raw or "").strip()
    if not value:
        raise LinkError("Link is empty")
    if kind not in LINK_KINDS:
        raise LinkError("Unknown link type")

    if kind == "phone":
        digits = re.sub(r"[^\d+]", "", value.removeprefix("tel:"))
        if len(re.sub(r"\D", "", digits)) < 7:
            raise LinkError("Enter a valid phone number")
        return f"tel:{digits}"
    if kind == "email":
        email = value.removeprefix("mailto:")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise LinkError("Enter a valid email")
        return f"mailto:{email}"
    if kind == "whatsapp":
        digits = re.sub(r"\D", "", value.replace("https://wa.me/", ""))
        if not 7 <= len(digits) <= 15:
            raise LinkError("Enter the WhatsApp number with country code")
        return f"https://wa.me/{digits}"

    # Bare handle shortcuts for the social platforms.
    if kind in ("instagram", "facebook") and not value.startswith(("http://", "https://")):
        if "." not in value:
            value = f"https://{kind}.com/{value.lstrip('@')}"
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    if value.startswith("http://"):
        value = "https://" + value[len("http://") :]

    parsed = urlparse(value)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if not host or "." not in host:
        raise LinkError("Enter a valid URL")
    if any(host == h or host.endswith("." + h) for h in own_hosts):
        raise LinkError("Links cannot point back to this site")
    allowed = _HOSTS.get(kind)
    if allowed and not any(host == h or host.endswith("." + h) for h in allowed):
        raise LinkError(f"That doesn't look like {_NAMES.get(kind, 'the right')} link")
    return value
