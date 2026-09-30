import type { Metadata } from "next";

import { FlowFrame } from "@/components/flow/Frame";
import { StaffConsole } from "@/components/rewards/StaffConsole";

export const metadata: Metadata = { title: "Staff counter", robots: "noindex, nofollow" };

// Outside /r so the customer surface stays light. PIN-gated.
export default async function StaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <FlowFrame>
      <StaffConsole slug={slug} />
    </FlowFrame>
  );
}
