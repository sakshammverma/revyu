import { handler, HttpError } from "@/server/http";
import { anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { ImageError, saveImage } from "@/server/services/storage";

export const POST = handler(async (request: Request, ctx: OutletCtx) => {
  await anyOutlet(request, ctx);
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    throw new HttpError(422, "VALIDATION_ERROR");
  }
  if (!(file instanceof File)) throw new HttpError(422, "VALIDATION_ERROR");
  try {
    return Response.json({ url: await saveImage(new Uint8Array(await file.arrayBuffer())) }, { status: 201 });
  } catch (e) {
    if (e instanceof ImageError) throw new HttpError(422, "BAD_IMAGE", e.message);
    throw e;
  }
});
