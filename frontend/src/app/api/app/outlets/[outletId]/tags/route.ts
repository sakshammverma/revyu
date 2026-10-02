import { outletGet } from "@/server/dashboardRoutes";
import { getTagFrequency } from "@/server/services/dashboard";

export const GET = outletGet((db, outlet, request) =>
  getTagFrequency(db, outlet, new URL(request.url).searchParams.get("range") ?? "30d"),
);
