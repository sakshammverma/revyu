"use client";

import { useEffect, useState } from "react";

import { CustomerFlow } from "@/components/flow/CustomerFlow";
import { FlowFrame } from "@/components/flow/Frame";
import { fetchApprovalPreview } from "@/lib/admin/api";
import type { FlowConfig } from "@/lib/flow/api";

export function PreviewClient({ outletId }: { outletId: string }) {
  const [config, setConfig] = useState<FlowConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchApprovalPreview(outletId)
      .then((c) => !cancelled && setConfig(c))
      .catch(() => !cancelled && setError("Couldn't load this preview. It may already be approved or rejected."));
    return () => {
      cancelled = true;
    };
  }, [outletId]);

  if (error) return <p className="text-sm text-urgency text-center">{error}</p>;
  if (!config) return <p className="text-sm text-ink-muted text-center">Loading preview…</p>;

  // The real customer-flow component (FR-77) in preview mode: nothing recorded.
  return (
    <FlowFrame>
      <CustomerFlow slug={`preview-${outletId}`} config={config} />
    </FlowFrame>
  );
}
