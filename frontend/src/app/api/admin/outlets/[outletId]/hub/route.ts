import { getEnv } from "@/server/env";
import { handler, parseJson } from "@/server/http";
import { type OutletCtx, noContent, anyOutlet } from "@/server/hubRoute";
import { hubModeBody } from "@/server/hubSchemas";
import { editorState, setHubMode } from "@/server/services/hubConfig";

export const GET = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  return Response.json({ ...(await editorState(db, outlet)), origin: getEnv().publicFlowBaseUrl });
});

export const PATCH = handler(async (request: Request, ctx: OutletCtx) => {
  const { db, outlet } = await anyOutlet(request, ctx);
  const body = await parseJson(request, hubModeBody);
  await setHubMode(db, outlet, body.hub_mode);
  return noContent();
});
