import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { bulkImport } from "@/server/services/adminOutlets";

export const POST = handler(async (request: Request) => {
  requireAdmin(request);
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    throw new HttpError(422, "VALIDATION_ERROR");
  }
  if (!(file instanceof File)) throw new HttpError(422, "VALIDATION_ERROR");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new HttpError(422, "VALIDATION_ERROR"); // Python: undecodable file -> 500
  }
  return Response.json(await bulkImport(getDb(), text));
});
