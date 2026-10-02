import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { adminApplyReward } from "@/server/services/referrals";
import { guidParam } from "@/server/services/routeParams";

type Ctx = { params: Promise<{ reward_id: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  requireAdmin(request);
  return Response.json(await adminApplyReward(getDb(), guidParam((await params).reward_id)));
});
