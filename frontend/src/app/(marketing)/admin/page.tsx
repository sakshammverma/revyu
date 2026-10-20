import { redirect } from "next/navigation";

// /admin has no page of its own; the cockpit is the founder's home.
export default function AdminIndex() {
  redirect("/admin/metrics");
}
