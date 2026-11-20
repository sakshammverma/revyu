import { createHash } from "node:crypto";

import type { Metadata } from "next";

import { CustomerFlow } from "@/components/flow/CustomerFlow";
import { FlowFrame } from "@/components/flow/Frame";
import type { FlowConfig } from "@/lib/flow/api";
import { VIA_DECK } from "@/lib/marketing/salesTypes";
import { readTryToken } from "@/server/services/salesDemo";
import { verticalTags } from "@/server/verticals";
import { DemoEnded } from "./DemoEnded";

export const metadata: Metadata = {
  title: "Try it as your customer · Revyu",
  robots: { index: false, follow: false },
};

// The link expires, so it is checked on every request, never cached.
export const dynamic = "force-dynamic";

/**
 * The scan-to-try page from the in-shop sales demo: the real customer flow
 * with the prospect's shop name and category, fed from a signed link instead
 * of a database row. `preview` records nothing (no session, no events, no
 * feedback). The Google step is a labelled stand-in, never the real listing:
 * an owner posting on their own listing breaks Google's rules.
 */
export default async function TryPage({
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

  const fromDeck = via === VIA_DECK;
  const config: FlowConfig = {
    collecting: true,
    preview: true,
    locale: "en",
    outlet: {
      id: "demo",
      business_name: shop.name,
      logo_url: null,
      vertical: shop.vertical,
      google_review_url: `/marketing/try/${token}/google${fromDeck ? `?via=${VIA_DECK}` : ""}`,
    },
    tags: verticalTags(shop.vertical).map((tag, i) => ({
      id: `${shop.vertical}-${i}`,
      label: tag.label,
      phrases: tag.phrases,
      sort_order: i,
    })),
  };
  // One slug per link, so a saved step from one shop's demo never shows up in another's.
  const slug = "mkt-" + createHash("sha256").update(token).digest("hex").slice(0, 10);

  return (
    <FlowFrame>
      <CustomerFlow
        slug={slug}
        config={config}
        languages={["en", "hi"]}
        demo
        doneSlot={
          <div className="mt-1 pt-4 border-t border-line flex flex-col gap-2">
            {fromDeck ? (
              // A plain link: a full page load is what restores the deck from sessionStorage.
              <a
                href="/marketing?resume=dashboard"
                className="min-h-[44px] inline-flex items-center justify-center text-sm font-semibold text-text-2 hover:text-ink"
              >
                <span aria-hidden>←</span>&nbsp;Back to the demo
              </a>
            ) : (
              <p className="text-sm text-text-2 leading-relaxed">
                That&rsquo;s everything your customer does. Your QR will open this with your shop&rsquo;s name.
              </p>
            )}
          </div>
        }
      />
    </FlowFrame>
  );
}
