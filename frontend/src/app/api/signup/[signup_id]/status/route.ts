import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { guidParam } from "@/server/services/routeParams";
import { getSignupOutlet, signupStatus } from "@/server/services/signup";

type Ctx = { params: Promise<{ signup_id: string }> };

export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const signupId = guidParam((await params).signup_id);
  const db = getDb();
  return Response.json(await signupStatus(db, await getSignupOutlet(db, signupId)));
});
