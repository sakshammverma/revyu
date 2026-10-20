import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import { Button } from "@/components/chrome/Button";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { MonoLabel } from "@/components/chrome/MonoLabel";
import { Section } from "@/components/chrome/Grid";

export const metadata: Metadata = pageMetadata({
  path: "/contact",
  title: "Contact — Revyu",
  description:
    "How to reach the Revyu team for setup help, billing questions or anything about your QR code.",
});

export default function ContactPage() {
  return (
    <MarketingPage>
      <Section className="pt-12 sm:pt-20 pb-8 sm:pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <MonoLabel tone="muted">Contact</MonoLabel>
          <h1 className="heading-h1 font-display mt-4 text-ink tracking-tight">Talk to us.</h1>
          <p className="mt-4 max-w-xl mx-auto text-base sm:text-lg text-text-2 leading-relaxed">
            Questions about pricing, compliance, or getting set up — reach out
            directly. We reply the same day.
          </p>
        </div>
      </Section>

      <Section className="pb-20">
        <div className="v2-sheet border border-line p-6 sm:p-8 max-w-xl mx-auto">
          <div className="flex flex-col gap-4">
            <ContactRow label="Email" value="hello@revyu.in" href="mailto:hello@revyu.in" />
          </div>
        </div>

        <div className="mt-10 max-w-xl mx-auto text-center">
          <p className="text-sm sm:text-base text-text-2 leading-relaxed">
            Already a customer with a support question? Log in to your
            dashboard — private feedback and support requests are handled
            there.
          </p>
          <div className="mt-6">
            <Button variant="secondary" href="/app/login">
              Go to dashboard
            </Button>
          </div>
        </div>
      </Section>
    </MarketingPage>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-4 last:border-b-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-2">{label}</p>
      <a href={href} className="font-display text-lg sm:text-xl text-accent hover:text-ink transition-colors">
        {value}
      </a>
    </div>
  );
}
