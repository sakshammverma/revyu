"""Module registry as data (FR-78). Adding a module = one entry here + a route.

The order below is the default hub order (FR-79). Tile labels are deliberately
neutral (FR-80): no label refers to another module.
"""
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModuleDef:
    key: str
    label: str
    blurb: str
    icon: str
    route: str  # path suffix under /r/{slug}


MODULES: tuple[ModuleDef, ...] = (
    ModuleDef("review", "Share your experience", "Tell us how it went", "pencil", "review"),
    ModuleDef("connect", "Connect with us", "Directions, social and contact", "link", "connect"),
    ModuleDef("menu", "Services", "What we offer", "menu", "menu"),
    ModuleDef("rewards", "Rewards", "Badges and offers for regulars", "badge", "rewards"),
)
MODULE_KEYS = tuple(m.key for m in MODULES)
_BY_KEY = {m.key: m for m in MODULES}

_VERTICAL_DIR = Path(__file__).resolve().parent.parent / "verticals"


def module_def(key: str) -> ModuleDef:
    return _BY_KEY[key]


def menu_label(vertical: str) -> str:
    """'Menu' for food businesses, 'Services' otherwise. Driven by an optional
    `menu_label` in the vertical JSON (FR-75), never hardcoded per business."""
    path = _VERTICAL_DIR / f"{vertical}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("menu_label", "Services")
    except (OSError, ValueError):
        return "Services"


def label_for(key: str, vertical: str) -> str:
    return menu_label(vertical) if key == "menu" else _BY_KEY[key].label
