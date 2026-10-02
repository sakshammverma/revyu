// Read-only programme info lives here; join/recover/wallet/code are the sub-routes beside this file.
import { slugGet } from "@/server/routes";
import { getRewardsPayload } from "@/server/services/hub";

export const GET = slugGet(getRewardsPayload);
