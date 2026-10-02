/**
 * Request body schemas for the owner hub-config endpoints. Mirrors the
 * pydantic models in backend/app/api/hub_config.py (limits copied verbatim).
 * `guid`, not `uuid`, because pydantic's UUID accepts any 8-4-4-4-12 hex string.
 */
import { z } from "zod";

/** Pydantic min_length=1 accepts blanks and stores ""; we reject blank-after-trim instead. */
const name = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0);

export const hubModeBody = z.object({ hub_mode: z.enum(["direct", "menu"]) });

export const modulesBody = z.object({
  modules: z.array(z.object({ module: z.string(), enabled: z.boolean() })).max(10),
});

export const profileBody = z.object({
  tagline: z.string().max(160).nullish(),
  cover_image_url: z.string().max(300).nullish(),
  address_line: z.string().max(240).nullish(),
  locality: z.string().max(120).nullish(),
  phone: z.string().max(32).nullish(),
  // Day -> [[open, close], ...]. Pairs are enforced: a malformed pair would crash the public hub page.
  hours: z.record(z.string(), z.array(z.array(z.string()).length(2))).nullish(),
});

export const linksBody = z.object({
  links: z
    .array(
      z.object({
        kind: z.string(),
        label: z.string().max(60).nullish(),
        url: z.string().max(500),
        enabled: z.boolean().default(true),
      }),
    )
    .max(20),
});

export const categoryBody = z.object({ name: name(80) });

export const itemBody = z.object({
  category_id: z.guid().nullish(),
  name: name(120),
  description: z.string().max(400).nullish(),
  amount_minor: z.number().int().min(0).max(100_000_000).nullish(),
  price_on_request: z.boolean().default(false),
  price_prefix: z.string().max(12).nullish(),
  duration_min: z.number().int().min(1).max(1440).nullish(),
  dietary: z.array(z.string()).max(6).default([]),
  photo_url: z.string().max(300).nullish(),
  available: z.boolean().default(true),
});

export const orderBody = z.object({ ids: z.array(z.guid()).max(500) });

/** Admin only: PUT .../hub/availability. */
export const availabilityBody = z.object({ module: z.string(), available: z.boolean() });
