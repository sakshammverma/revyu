// Only the read-only wallet info lives here. join/recover/wallet/code stay on the
// FastAPI backend until the loyalty service is ported (plan phase 6); Next falls
// through to the /api rewrite for those paths.
import { slugGet } from "@/server/routes";
import { getRewardsPayload } from "@/server/services/hub";

export const GET = slugGet(getRewardsPayload);
