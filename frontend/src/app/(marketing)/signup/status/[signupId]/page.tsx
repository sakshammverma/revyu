import type { Metadata } from "next";

import { MarketingPage } from "@/components/chrome/MarketingPage";
import { MonoLabel } from "@/components/chrome/MonoLabel";
import { Section } from "@/components/chrome/Grid";
import { SignupStatus } from "@/components/marketing/SignupStatus";

export const metadata: Metadata = {
  title: "Your signup — Revyu",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ signupId: string }>;
  searchParams: Promise<{ paid?: string }>;
}

export default async function SignupStatusPage({ params, searchParams }: Props) {
  const { signupId } = await params;
  const { paid } = await searchParams;

  return (
    <MarketingPage>
      <Section className="pt-12 sm:pt-20 pb-8 sm:pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <MonoLabel tone="muted">Sign up</MonoLabel>
          <h1 className="heading-h2 mt-4">{paid ? "Thank you. You’re almost live." : "Your Revyu signup"}</h1>
        </div>
      </Section>
      <Section className="pb-20">
        <SignupStatus signupId={signupId} justPaid={paid === "1"} />
      </Section>
    </MarketingPage>
  );
}
