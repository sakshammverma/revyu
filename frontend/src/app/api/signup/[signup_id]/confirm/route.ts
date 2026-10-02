import { getDb } from "@/server/db";
import { handler, parseJson } from "@/server/http";
import { guidParam } from "@/server/services/routeParams";
import { confirmBody, confirmSignup } from "@/server/services/signup";

type Ctx = { params: Promise<{ signup_id: string }> };

export const POST = handler(async (request: Request, { params }: Ctx) => {
  const signupId = guidParam((await params).signup_id);
  const body = await parseJson(request, confirmBody);
  return Response.json(await confirmSignup(getDb(), signupId, body));
});
