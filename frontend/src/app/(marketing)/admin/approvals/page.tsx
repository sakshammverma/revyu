import type { Metadata } from "next";

import { ApprovalQueue } from "@/components/admin/ApprovalQueue";

// Founder-only, not linked publicly, not indexed (04-ARCHITECTURE.md §3.3).
export const metadata: Metadata = {
  title: "Approval queue — Revyu Admin",
  robots: "noindex, nofollow",
};

export default function AdminApprovalsPage() {
  return (
    <main className="flex-1 min-h-screen bg-[#f2f7f7] px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-4xl mx-auto mb-5 sm:mb-6">Approval queue</h1>
      <ApprovalQueue />
    </main>
  );
}
