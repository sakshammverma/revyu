import { requireOwner } from "@/server/auth/owner";
import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { requireAssetOutlet } from "@/server/assetsRoute";
import { GENERATORS, type PrintAsset } from "@/server/services/printAssets";

export const GET = handler(async (request: Request, ctx: { params: Promise<{ outletId: string; asset: string }> }) => {
  const db = getDb();
  const owner = await requireOwner(request, db);
  const { outletId, asset } = await ctx.params;
  const outlet = await requireAssetOutlet(db, owner, outletId);
  const generate = Object.hasOwn(GENERATORS, asset) ? GENERATORS[asset as PrintAsset] : undefined;
  if (!generate) throw new HttpError(404, "OUTLET_NOT_FOUND");
  return new Response(new Uint8Array(await generate(outlet.slug, outlet.businessName)), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${asset}-${outlet.slug}.pdf"`,
    },
  });
});
