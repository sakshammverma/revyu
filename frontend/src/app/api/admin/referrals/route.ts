import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { adminListRewards } from "@/server/services/referrals";

export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status");
  return Response.json(await adminListRewards(getDb(), status || null));
});
