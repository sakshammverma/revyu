import type { Metadata } from "next";
import Link from "next/link";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { CustomerProfile } from "@/components/admin/CustomerProfile";

export const metadata: Metadata = { title: "Customer — Revyu Admin", robots: "noindex, nofollow" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-3 py-4 sm:px-8 sm:py-6">
      <Link
        href="/admin/customers"
        className="mb-2 text-sm font-semibold text-text-2 hover:text-ink min-h-[44px] inline-flex items-center gap-1"
      >
        ← Customers
      </Link>
      <AdminTokenGate>
        <CustomerProfile outletId={id} />
      </AdminTokenGate>
    </main>
  );
}
