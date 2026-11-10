/**
 * Per-vertical config. Copied from backend/app/verticals/*.json; this copy
 * becomes the only one when the Python backend is retired. Only the fields the
 * TypeScript services need are typed here.
 */
import automotive from "./automotive.json";
import bakery from "./bakery.json";
import coaching from "./coaching.json";
import dental from "./dental.json";
import electronics from "./electronics.json";
import general from "./general.json";
import grocery from "./grocery.json";
import gym from "./gym.json";
import pharmacy from "./pharmacy.json";
import physiotherapy from "./physiotherapy.json";
import restaurant from "./restaurant.json";
import retail from "./retail.json";
import salon from "./salon.json";

interface VerticalConfig {
  [field: string]: unknown;
  menu_label?: string;
}

const VERTICALS: Record<string, VerticalConfig> = {
  automotive,
  bakery,
  coaching,
  dental,
  electronics,
  general,
  grocery,
  gym,
  pharmacy,
  physiotherapy,
  restaurant,
  retail,
  salon,
};

/**
 * "Menu" for food businesses, "Services" otherwise. Driven by an optional
 * `menu_label` in the vertical JSON (FR-75), never hardcoded per business.
 */
export function menuLabel(vertical: string): string {
  return VERTICALS[vertical]?.menu_label ?? "Services";
}

export const DEFAULT_VERTICAL = "general";

/** Sorted vertical keys (backend/app/seeds/tags.py list_verticals). */
export function listVerticals(): string[] {
  return Object.keys(VERTICALS).sort();
}

export interface TagSeed {
  label: string;
  phrases: string[];
}

/**
 * Seed tag set for a vertical (CR-1: short fragments mapped to one
 * customer-selected attribute, never a full review sentence). Unknown
 * verticals fall back to the general shop tags, like the Python loader; signup rejects them
 * up front so that fallback is never silently used.
 */
export function verticalTags(vertical: string): TagSeed[] {
  const config = VERTICALS[vertical] ?? VERTICALS[DEFAULT_VERTICAL];
  return config.tags as TagSeed[];
}
