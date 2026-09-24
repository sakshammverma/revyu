"use client";

import { useMemo } from "react";

import { HubEditor } from "@/components/hub-editor/HubEditor";
import { adminHubApi } from "@/lib/hub/api";

// Concierge setup: the same editor the owner uses, over the admin transport.
export function OutletHubAdmin({ outletId }: { outletId: string }) {
  const api = useMemo(() => adminHubApi(outletId), [outletId]);
  return (
    <div className="max-w-6xl mx-auto">
      <HubEditor api={api} isAdmin />
    </div>
  );
}
