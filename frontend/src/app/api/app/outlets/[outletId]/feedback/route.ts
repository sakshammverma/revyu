import { outletGet } from "@/server/dashboardRoutes";
import { getFeedbackInbox } from "@/server/services/dashboard";

export const GET = outletGet((db, outlet) => getFeedbackInbox(db, outlet));
