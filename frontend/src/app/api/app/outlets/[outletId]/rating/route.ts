import { outletGet } from "@/server/dashboardRoutes";
import { getRating } from "@/server/services/dashboard";

export const GET = outletGet((db, outlet) => getRating(db, outlet));
