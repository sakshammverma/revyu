import { getDb } from "@/server/db";
import { handler, rateLimit } from "@/server/http";
import { publicPricing, visitorCountry } from "@/server/services/pricing";

export const GET = handler(async (request: Request) => {
  await rateLimit(request, "pricing", 120, 3600);
  const body = await publicPricing(getDb(), visitorCountry(request));
  return Response.json(body, {
    // Depends on the visitor's country, so never share a cached copy across countries.
    headers: { "Cache-Control": "private, max-age=300", Vary: "x-vercel-ip-country" },
  });
});
