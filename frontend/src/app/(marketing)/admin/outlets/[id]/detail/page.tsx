import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { OutletDetailView } from "@/components/admin/OutletDetailView";

export const metadata: Metadata = { title: "Outlet detail — Revyu Admin", robots: "noindex, nofollow" };

export default async function AdminOutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <div className="max-w-5xl mx-auto mb-4 flex flex-wrap gap-x-5">
        <a href="/admin/outlets" className="text-sm font-semibold text-accent-hover hover:underline min-h-[44px] inline-flex items-center">
          ← All outlets
        </a>
        <a href={`/admin/outlets/${id}`} className="text-sm font-semibold text-accent-hover hover:underline min-h-[44px] inline-flex items-center">
          QR page setup →
        </a>
      </div>
      <AdminTokenGate>
        <OutletDetailView outletId={id} />
      </AdminTokenGate>
    </main>
  );
}
