"""Outlet state → what the short URL serves.

See documents/05-DATA-MODEL.md §4.1 (ANCHOR: outlet-states) and §4.1a
(ANCHOR: collection-stops). This is the single source of truth for the
`collecting` flag — every other module (flow config, resolution, trial
metering) must call `is_collecting`, never re-derive it from `state`.
"""

COLLECTING_STATES = frozenset({"trial", "locked", "active", "past_due"})


def is_collecting(state: str) -> bool:
    """True if a scan should get the full flow; False for the neutral screen.

    `locked` still collects (FR-45) — the dashboard locks, not the QR.
    Only `suspended`/`deactivated` (and pre-live states) stop collection.
    """
    return state in COLLECTING_STATES
