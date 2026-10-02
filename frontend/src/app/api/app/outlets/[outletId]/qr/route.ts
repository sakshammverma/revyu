import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { requireAssetOutlet } from "@/server/assetsRoute";
import { generateQrPng, generateQrSvg } from "@/server/services/qr";

export const GET = handler(async (request: Request, ctx: { params: Promise<{ outletId: string }> }) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const outlet = await requireAssetOutlet(db, owner, (await ctx.params).outletId);
  if (new URL(request.url).searchParams.get("format") === "svg") {
    return new Response(generateQrSvg(outlet.slug), { headers: { "content-type": "image/svg+xml" } });
  }
  return new Response(new Uint8Array(await generateQrPng(outlet.slug)), { headers: { "content-type": "image/png" } });
});
