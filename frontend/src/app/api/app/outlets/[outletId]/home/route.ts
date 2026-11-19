import { outletGet } from "@/server/dashboardRoutes";
import { getHome, trendRange } from "@/server/services/dashboard";

// One request for the whole Overview page. Not `lockable`: the all-time counts stay
// readable while locked (SRS-9.8) and getHome itself withholds the detailed parts.
export const GET = outletGet(
  (db, outlet, request) => getHome(db, outlet, trendRange(new URL(request.url).searchParams.get("range"))),
  { lockable: false },
);
