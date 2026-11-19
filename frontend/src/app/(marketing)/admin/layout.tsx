import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = { title: "Revyu Admin", robots: { index: false, follow: false } };

// Shared admin chrome. Founder-only; every page still carries its own token gate.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <ToastProvider>{children}</ToastProvider>
    </AdminShell>
  );
}
