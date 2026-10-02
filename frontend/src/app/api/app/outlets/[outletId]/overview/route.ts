import { outletGet } from "@/server/dashboardRoutes";
import { getOverview } from "@/server/services/dashboard";

export const GET = outletGet((db, outlet) => getOverview(db, outlet));
