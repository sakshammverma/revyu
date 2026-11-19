import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { CustomersView } from "@/components/admin/CustomersView";

export const metadata: Metadata = { title: "Customers — Revyu Admin", robots: "noindex, nofollow" };

export default function AdminCustomersPage() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-3 py-5 sm:px-8 sm:py-8">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-ink">Customers</h1>
        <p className="text-sm text-text-2 mt-1">Every business on Revyu. The ones that need you come first.</p>
      </div>
      <AdminTokenGate>
        <CustomersView />
      </AdminTokenGate>
    </main>
  );
}
