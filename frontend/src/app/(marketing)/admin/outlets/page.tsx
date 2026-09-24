import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { OutletManager } from "@/components/admin/OutletManager";

// Founder-only, not linked publicly, not indexed (04-ARCHITECTURE.md §3.3).
export const metadata: Metadata = {
  title: "Outlets — Revyu Admin",
  robots: "noindex, nofollow",
};

export default function AdminOutletsPage() {
  return (
    <main className="flex-1 min-h-screen bg-[#f2f7f7] px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-5xl mx-auto mb-5 sm:mb-6">Outlets</h1>
      <AdminTokenGate>
        <OutletManager />
      </AdminTokenGate>
    </main>
  );
}
