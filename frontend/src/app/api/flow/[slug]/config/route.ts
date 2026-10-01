import { slugGet } from "@/server/routes";
import { buildFlowConfig } from "@/server/services/flow";

export const GET = slugGet((db, outlet) => buildFlowConfig(db, outlet));
