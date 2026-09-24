import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";

import { PreviewClient } from "./PreviewClient";

// Founder-only approval preview (SRS-19.2). Not linked publicly, not indexed.
export const metadata: Metadata = {
  title: "Preview — Revyu Admin",
  robots: "noindex, nofollow",
};

interface Props {
  params: Promise<{ outletId: string }>;
}

export default async function AdminPreviewPage({ params }: Props) {
  const { outletId } = await params;
  return (
    <main className="min-h-screen bg-paper p-6">
      <AdminTokenGate>
        <PreviewClient outletId={outletId} />
      </AdminTokenGate>
    </main>
  );
}
