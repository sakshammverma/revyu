import type { Metadata } from "next";

import { DemoGoogle } from "@/components/flow/DemoGoogle";
import { FlowFrame } from "@/components/flow/Frame";
import { VIA_DECK } from "@/lib/marketing/salesTypes";
import { readTryToken } from "@/server/services/salesDemo";
import { DemoEnded } from "../DemoEnded";

export const metadata: Metadata = {
  title: "Demo: the Google step · Revyu",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Stands in for the shop's Google review page in the scan-to-try demo (labelled as a stand-in).
export default async function TryGooglePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { via } = await searchParams;
  const shop = readTryToken(token);
  if (!shop || "expired" in shop) return <DemoEnded />;
  return (
    <FlowFrame>
      <DemoGoogle
        businessName={shop.name}
        backHref={`/marketing/try/${token}${via === VIA_DECK ? `?via=${VIA_DECK}` : ""}`}
      />
    </FlowFrame>
  );
}
