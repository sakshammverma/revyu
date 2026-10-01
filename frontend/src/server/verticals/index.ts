/**
 * Per-vertical config. Copied from backend/app/verticals/*.json; this copy
 * becomes the only one when the Python backend is retired. Only the fields the
 * TypeScript services need are typed here.
 */
import coaching from "./coaching.json";
import dental from "./dental.json";
import general from "./general.json";
import gym from "./gym.json";
import physiotherapy from "./physiotherapy.json";
import salon from "./salon.json";

interface VerticalConfig {
  [field: string]: unknown;
  menu_label?: string;
}

const VERTICALS: Record<string, VerticalConfig> = { coaching, dental, general, gym, physiotherapy, salon };

/**
 * "Menu" for food businesses, "Services" otherwise. Driven by an optional
 * `menu_label` in the vertical JSON (FR-75), never hardcoded per business.
 */
export function menuLabel(vertical: string): string {
  return VERTICALS[vertical]?.menu_label ?? "Services";
}
