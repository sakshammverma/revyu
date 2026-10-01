import { slugGet } from "@/server/routes";
import { getConnectPayload } from "@/server/services/hub";

export const GET = slugGet(getConnectPayload);
