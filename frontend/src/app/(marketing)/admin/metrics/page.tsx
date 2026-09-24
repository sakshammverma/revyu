import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { CockpitView } from "@/components/admin/CockpitView";

export const metadata: Metadata = { title: "Metrics — Revyu Admin", robots: "noindex, nofollow" };

export default function AdminMetricsPage() {
  return (
    <main className="flex-1 bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-5xl mx-auto mb-5 sm:mb-6">Metrics</h1>
      <AdminTokenGate>
        <CockpitView />
      </AdminTokenGate>
    </main>
  );
}
