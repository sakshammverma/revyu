import { outletGet } from "@/server/dashboardRoutes";
import { getOverview } from "@/server/services/dashboard";

// The locked dashboard still shows these counts (SRS-9.8).
export const GET = outletGet((db, outlet) => getOverview(db, outlet), { lockable: false });
