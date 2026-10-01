import { slugGet } from "@/server/routes";
import { getMenuPayload } from "@/server/services/hub";

export const GET = slugGet(getMenuPayload);
