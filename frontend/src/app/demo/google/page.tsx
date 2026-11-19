import type { Metadata } from "next";

import { DemoGoogle } from "@/components/flow/DemoGoogle";
import { FlowFrame } from "@/components/flow/Frame";
import { getDemoVertical } from "@/lib/marketing/demo";

export const metadata: Metadata = {
  title: "Demo: the Google step · Revyu",
  robots: { index: false },
};

// Stands in for the shop's Google review page in the /demo walkthrough.
export default function DemoGooglePage() {
  return (
    <FlowFrame>
      <DemoGoogle businessName={getDemoVertical("general").exampleBusiness} />
    </FlowFrame>
  );
}
