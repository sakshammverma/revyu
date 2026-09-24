import type { Metadata } from "next";
import Link from "next/link";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { OutletHubAdmin } from "@/components/admin/OutletHubAdmin";

export const metadata: Metadata = {
  title: "Outlet QR page — Revyu Admin",
  robots: "noindex, nofollow",
};

export default async function AdminOutletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 min-h-screen bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <div className="max-w-6xl mx-auto mb-5 sm:mb-6">
        <Link href="/admin/outlets" className="text-sm font-semibold text-text-2 min-h-[44px] inline-flex items-center">← Outlets</Link>
        <h1 className="heading-h3">QR page setup</h1>
      </div>
      <AdminTokenGate>
        <OutletHubAdmin outletId={id} />
      </AdminTokenGate>
    </main>
  );
}
