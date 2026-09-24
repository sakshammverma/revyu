import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { PendingSendsView } from "@/components/admin/PendingSendsView";

export const metadata: Metadata = { title: "Pending sends — Revyu Admin", robots: "noindex, nofollow" };

export default function AdminPendingSendsPage() {
  return (
    <main className="flex-1 bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-3xl mx-auto mb-5 sm:mb-6">Pending sends</h1>
      <AdminTokenGate>
        <PendingSendsView />
      </AdminTokenGate>
    </main>
  );
}
