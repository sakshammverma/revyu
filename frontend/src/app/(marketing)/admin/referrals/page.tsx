import type { Metadata } from "next";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import { ReferralRewards } from "@/components/admin/ReferralRewards";

export const metadata: Metadata = {
  title: "Referrals — Revyu Admin",
  robots: "noindex, nofollow",
};

export default function AdminReferralsPage() {
  return (
    <main className="flex-1 min-h-screen bg-bg px-3 py-6 sm:px-8 sm:py-10">
      <h1 className="heading-h3 max-w-5xl mx-auto mb-5 sm:mb-6">Referrals</h1>
      <AdminTokenGate>
        <ReferralRewards />
      </AdminTokenGate>
    </main>
  );
}
