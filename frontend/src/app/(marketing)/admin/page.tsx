import { redirect } from "next/navigation";

// /admin has no page of its own; the customer monitor is the founder's home.
export default function AdminIndex() {
  redirect("/admin/customers");
}
