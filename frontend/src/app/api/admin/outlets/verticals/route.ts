import { requireAdmin } from "@/server/auth/admin";
import { handler } from "@/server/http";
import { listVerticals } from "@/server/verticals";

// SRS-11.14: verticals are config files; this reflects what is configured.
export const GET = handler(async (request: Request) => {
  requireAdmin(request);
  return Response.json({ verticals: listVerticals() });
});
