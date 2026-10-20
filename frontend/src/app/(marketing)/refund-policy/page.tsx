import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = pageMetadata({
  path: "/refund-policy",
  title: "Refund Policy — Revyu",
  description:
    "When you pay, when you do not, and how refunds work.",
});

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" subtitle="When you pay, when you don’t, and how refunds work">
      <p>
        This page is not final legal copy and should be reviewed by counsel
        before relying on it.
      </p>

      <h2>Signup rejected or unverifiable</h2>
      <p>
        You set up autopay at signup, but nothing is charged until your
        15-day trial ends, and the trial only starts once we verify your
        business against Google&rsquo;s records. If we cannot confirm the
        match — for example, we can&rsquo;t locate your business on Google
        Places, or the details don&rsquo;t line up — your outlet is rejected
        and you pay nothing. If any payment was taken, you receive a full
        refund to your original payment method within 5–7 business days.
      </p>

      <h2>Cancelling an active subscription</h2>
      <p>
        You can cancel at any time from your dashboard. Cancellation takes
        effect at the end of your current billing period; we don&rsquo;t
        refund the remainder of a period already paid for.
      </p>

      <h2>Failed payments</h2>
      <p>
        If a recurring payment fails, you get a 7-day grace period with your
        QR fully live while we retry. This isn&rsquo;t a refund scenario —
        no charge succeeded, so there&rsquo;s nothing to refund.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Contact us with your business name and the payment date. We aim to
        resolve refund requests within 2 business days.
      </p>
    </LegalPage>
  );
}
