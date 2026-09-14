"""Click-to-chat: builds the wa.me link for the admin "pending sends" queue.

The founder taps through queued messages manually (documents/10-ROADMAP.md
1.3). Nothing here sends anything: unofficial WhatsApp automation is
explicitly rejected (OD-9) because of the ban risk on the number.
"""

import re
from urllib.parse import quote


def normalise_phone(phone: str | None) -> str | None:
    digits = re.sub(r"\D", "", phone or "")
    return digits if len(digits) >= 8 else None


def build_link(phone: str, body: str) -> str:
    return f"https://wa.me/{normalise_phone(phone)}?text={quote(body)}"
