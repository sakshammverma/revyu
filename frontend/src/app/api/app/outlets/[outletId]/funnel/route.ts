import { outletGet } from "@/server/dashboardRoutes";
import { getFunnel } from "@/server/services/dashboard";

export const GET = outletGet((db, outlet, request) =>
  getFunnel(db, outlet, new URL(request.url).searchParams.get("range") ?? "30d"),
);
