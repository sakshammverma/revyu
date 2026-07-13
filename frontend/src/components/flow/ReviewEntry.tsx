import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerFlow } from "@/components/flow/CustomerFlow";
import { Icon } from "@/components/hub/Icons";
import { fetchFlowConfig } from "@/lib/flow/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// The review flow itself, byte-for-byte as before (SRS-20.4). The optional
// back link sits outside it, so no hub logic enters the flow.
export async function ReviewEntry({
  slug,
  fireScan,
  backToHub,
}: {
  slug: string;
  fireScan: boolean;
  backToHub: boolean;
}) {
  const config = await fetchFlowConfig(slug);
  if (config === null) notFound(); // SRS-1.4: unknown slug, no existence leak.

  // Fire-and-forget scan event, never blocks render. Previews record nothing.
  if (fireScan && !config.preview)
    fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlet_id: config.outlet.id, events: [{ type: "scan", payload: {} }] }),
    }).catch(() => {});

  return (
    <>
      {backToHub && (
        <Link
          href={`/r/${slug}`}
          className="inline-flex items-center gap-2 min-h-[44px] mb-2 text-sm font-semibold text-[#1a1e23]"
        >
          <Icon name="back" className="w-5 h-5" />
          <span className="truncate max-w-[16rem]">{config.outlet.business_name}</span>
        </Link>
      )}
      <CustomerFlow slug={slug} config={config} />
    </>
  );
}
