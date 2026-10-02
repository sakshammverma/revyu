import { z } from "zod";

import { HttpError } from "@/server/http";

/** A path UUID; FastAPI answers 422 for a malformed one (after auth has passed). */
export function guidParam(value: string): string {
  if (!z.guid().safeParse(value).success) throw new HttpError(422, "VALIDATION_ERROR");
  return value;
}
