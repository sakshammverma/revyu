import { getDb } from "@/server/db";
import { handler, HttpError } from "@/server/http";
import { staffContext } from "@/server/loyaltyRoute";
import { findMemberByRef, openGrants, visitCount } from "@/server/services/loyalty";

type Ctx = { params: Promise<{ slug: string; publicId: string }> };

export const GET = handler(async (request: Request, { params }: Ctx) => {
  const { slug, publicId } = await params;
  const db = getDb();
  const { outlet } = await staffContext(db, request, slug);
  const member = await findMemberByRef(db, outlet.id, publicId);
  if (!member) throw new HttpError(404, "NOT_FOUND", "No such member.");
  return Response.json({
    member: { public_id: member.publicId, name: member.name },
    visits: await visitCount(db, member.id),
    // No redeem codes here: a lookup by member id doesn't prove the customer is
    // at the counter, so redeeming from a lookup needs the code on their phone.
    pending_rewards: (await openGrants(db, member.id))
      .filter((g) => g.status === "available")
      .map(({ redeem_code: _code, ...g }) => g), // eslint-disable-line @typescript-eslint/no-unused-vars
  });
});
