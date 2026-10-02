import { getEnv } from "@/server/env";
import { handler, parseJson } from "@/server/http";
import { noContent, anyOutlet, type OutletCtx } from "@/server/hubRoute";
import { linksBody } from "@/server/hubSchemas";
import { BadLinkError, ownHostsFrom, putLinks } from "@/server/services/hubConfig";

export const PUT = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, linksBody);
  try {
    await putLinks(db, outlet, body.links, ownHostsFrom(getEnv().publicFlowBaseUrl));
  } catch (e) {
    if (!(e instanceof BadLinkError)) throw e;
    // Same body as FastAPI, including the row index the editor highlights.
    const error: Record<string, unknown> = { code: "BAD_LINK", message: e.message };
    if (e.index !== undefined) error.index = e.index;
    return Response.json({ detail: { error } }, { status: 422 });
  }
  return noContent();
});
