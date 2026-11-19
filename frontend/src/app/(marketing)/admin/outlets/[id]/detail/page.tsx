import { redirect } from "next/navigation";

// The outlet detail grew into the customer profile; old links land there.
export default async function AdminOutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/customers/${id}`);
}
