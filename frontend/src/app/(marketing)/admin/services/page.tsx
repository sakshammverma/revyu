import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { ServicesAdmin } from "@/components/admin/ServicesAdmin";

export const metadata: Metadata = {
  title: "Services — Revyu Admin",
  robots: "noindex, nofollow",
};

export default function AdminServicesPage() {
  return (
    <main className="flex-1 min-h-screen bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-6xl mx-auto mb-5 sm:mb-6">Growth services</h1>
      <AdminTokenGate>
        <ServicesAdmin />
      </AdminTokenGate>
    </main>
  );
}
