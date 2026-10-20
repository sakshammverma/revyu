import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { PricingAdmin } from "@/components/admin/PricingAdmin";

export const metadata: Metadata = {
  title: "Pricing — Revyu Admin",
  robots: "noindex, nofollow",
};

export default function AdminPricingPage() {
  return (
    <main className="flex-1 min-h-screen bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-6xl mx-auto mb-5 sm:mb-6">Pricing</h1>
      <AdminTokenGate>
        <PricingAdmin />
      </AdminTokenGate>
    </main>
  );
}
