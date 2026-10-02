import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import {
  AmbiguousPlaceHttp,
  createOutlet,
  createOutletBody,
  listOutlets,
} from "@/server/services/adminOutlets";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  const q = new URL(request.url).searchParams;
  return Response.json(
    await listOutlets(getDb(), { state: q.get("state"), vertical: q.get("vertical"), source: q.get("source") }),
  );
});

export const POST = handler(async (request: Request) => {
  requireAdmin(request);
  const body = await parseJson(request, createOutletBody);
  try {
    return Response.json(await createOutlet(getDb(), body), { status: 201 });
  } catch (e) {
    if (e instanceof AmbiguousPlaceHttp) {
      return Response.json(
        {
          detail: {
            error: {
              code: "AMBIGUOUS_PLACE",
              message: "Multiple matches found — resolve manually",
              candidates: e.candidates,
            },
          },
        },
        { status: 409 },
      );
    }
    throw e;
  }
});
