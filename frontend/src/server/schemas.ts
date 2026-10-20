/**
 * Request body schemas for the public customer endpoints. Mirrors the
 * pydantic models in backend/app/schemas/{flow,events}.py. `guid` (not `uuid`)
 * because pydantic's UUID accepts any 8-4-4-4-12 hex string.
 */
import { z } from "zod";

export const sessionBody = z.object({
  session_id: z.guid(),
  device_hash: z.string().max(128).nullish(),
});

export const feedbackBody = z.object({
  session_id: z.guid(),
  rating: z.number().int().min(1).max(5).nullish(),
  message: z.string().max(2000),
  contact: z.string().max(200).nullish(),
  /** Client-generated, so a retry after a timeout can't store the message twice. */
  feedback_id: z.guid().nullish(),
});

export const eventsBody = z.object({
  outlet_id: z.guid(),
  session_id: z.guid().nullish(),
  events: z
    .array(
      z.object({
        type: z.string().max(40),
        payload: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    .max(50),
});

export const otpRequestBody = z.object({ email: z.email() });

export const otpVerifyBody = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

/** Google place ids are URL-safe base64; anything else never reaches the Places URL path. */
export const placeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{3,300}$/);

export const gapReportQuery = z.object({ place_id: placeIdSchema });

export const gapReportEmailBody = z.object({
  place_id: placeIdSchema,
  email: z.email(),
});
