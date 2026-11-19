import type { Metadata } from "next";
import Link from "next/link";

import { CustomerFlow } from "@/components/flow/CustomerFlow";
import { FlowFrame } from "@/components/flow/Frame";
import { Button } from "@/components/ui/Button";
import type { FlowConfig } from "@/lib/flow/api";
import { getDemoVertical } from "@/lib/marketing/demo";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/demo",
  title: "Try it as your customer · Revyu",
  description:
    "The real Revyu review page, on a fictional shop. Tap a star, pick what stood out, edit the draft and see the hand-off to Google. Nothing is recorded.",
});

// The same component a printed QR opens, fed a fixed example instead of a
// database row. `preview` means it records nothing (no session, no events, no
// feedback), so this page needs no backend and can't affect any real outlet.
const DEMO = getDemoVertical("general");
const DEMO_CONFIG: FlowConfig = {
  collecting: true,
  preview: true,
  locale: "en",
  outlet: {
    id: "demo",
    business_name: DEMO.exampleBusiness,
    logo_url: null,
    vertical: DEMO.key,
    // A stand-in for the shop's Google review page, so the whole loop can be tried.
    google_review_url: "/demo/google",
  },
  tags: DEMO.tags.map((tag, i) => ({ id: tag.id, label: tag.label, phrases: tag.phrases, sort_order: i })),
};

export default function DemoPage() {
  return (
    <FlowFrame>
      <Link href="/" className="inline-flex items-center gap-1.5 min-h-[44px] mb-1 text-sm font-semibold text-text-2 hover:text-ink">
        <span aria-hidden>←</span> Revyu
      </Link>
      <CustomerFlow
        slug="demo"
        config={DEMO_CONFIG}
        languages={["en", "hi"]}
        demo
        doneSlot={
          <div className="mt-1 pt-4 border-t border-line flex flex-col gap-2">
            <p className="text-sm text-text-2 leading-relaxed">
              That&rsquo;s everything your customer does. Yours carries your shop&rsquo;s name, tags and Google listing.
            </p>
            <Button href="/signup" full>
              Get this for my shop
            </Button>
            {/* A plain link: a full page load is what starts the demo over. */}
            <a href="/demo" className="min-h-[44px] inline-flex items-center justify-center text-sm font-semibold text-text-2 hover:text-ink">
              Run the demo again
            </a>
          </div>
        }
      />
    </FlowFrame>
  );
}
