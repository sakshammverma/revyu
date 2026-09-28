import type { Metadata } from "next";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { MonoLabel } from "@/components/chrome/MonoLabel";
import { Section } from "@/components/chrome/Grid";
import { SignupForm } from "@/components/marketing/SignupForm";

export const metadata: Metadata = {
  title: "Start your free trial — Revyu",
  description: "Set up your Google review collection QR in 3 minutes. 15-day free trial. Secure payment set-up, first charge after your trial.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; ref?: string | string[] }>;
}) {
  const { email, ref } = await searchParams;
  const initialEmail = typeof email === "string" ? email : "";
  const referralCode = typeof ref === "string" ? ref.slice(0, 16) : "";

  return (
    <MarketingPage>
      <Section className="pt-12 sm:pt-20 pb-8 sm:pb-10">
        <div className="max-w-2xl mx-auto text-center">
          <MonoLabel tone="muted">Fast 3-Minute Setup</MonoLabel>
          <h1 className="heading-h1 font-display mt-4 text-[#1a1e23] tracking-tight">
            Start your 15-day free trial
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#515a63] leading-relaxed">
            We verify your business before your QR code goes live — protecting your Google profile from ever pointing to the wrong listing.
          </p>
        </div>
      </Section>

      <Section className="pb-20">
        {referralCode && (
          <p className="max-w-2xl mx-auto mb-4 text-center text-sm text-[#2f6b1a] bg-[#f0f7ed] border border-[#449127]/25 rounded-xl px-4 py-2.5">
            A fellow business owner invited you. Thank you for trying Revyu.
          </p>
        )}
        <SignupForm initialEmail={initialEmail} referralCode={referralCode} />
      </Section>
    </MarketingPage>
  );
}
