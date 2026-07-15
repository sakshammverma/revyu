import { notFound } from "next/navigation";

import { FlowFrame } from "@/components/flow/Frame";
import { ReviewEntry } from "@/components/flow/ReviewEntry";
import { HubView } from "@/components/hub/HubView";
import { fetchHub, type HubPayload } from "@/lib/hub/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

// GET /r/{slug} — resolution decides what to serve, never whether
// (documents/04-ARCHITECTURE.md §4, 22-HUB-AND-MODULES.md SRS-20.1):
// state first, then hub_mode, then enabled-module count.
export default async function FlowPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // ?preview=1 is the editor's live preview: records nothing (like SRS-11.17).
  const quiet = (await searchParams).preview === "1";

  // A hub failure must never take the review flow down with it (C-6).
  let hub: HubPayload | null = null;
  try {
    hub = await fetchHub(slug);
  } catch {
    hub = null;
  }
  if (hub === null) {
    // Unknown slug or hub unreachable: the review entry decides (404 vs flow).
    return (
      <FlowFrame>
        <ReviewEntry slug={slug} fireScan={!quiet} backToHub={false} />
      </FlowFrame>
    );
  }

  if (hub.collecting && hub.mode === "hub") {
    // The scan still fires before the hub renders (SRS-20.2).
    if (!quiet)
      fetch(`${API_BASE}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_id: hub.outlet.id, events: [{ type: "scan", payload: {} }] }),
      }).catch(() => {});
    return (
      <FlowFrame>
        <HubView slug={slug} hub={hub} quiet={quiet} />
      </FlowFrame>
    );
  }

  if (!hub.outlet) notFound();
  return (
    <FlowFrame>
      <ReviewEntry slug={slug} fireScan={!quiet} backToHub={false} />
    </FlowFrame>
  );
}
