import { slugGet } from "@/server/routes";
import { getHubPayload } from "@/server/services/hub";

export const GET = slugGet(getHubPayload);
