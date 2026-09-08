"use client";

import { useMemo } from "react";

import { HubEditor } from "@/components/hub-editor/HubEditor";
import { useOwner } from "@/components/portal/OwnerContext";
import { ownerHubApi } from "@/lib/hub/api";

export default function HubPage() {
  const { outlet } = useOwner();
  const api = useMemo(() => ownerHubApi(outlet.outlet_id), [outlet.outlet_id]);
  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">QR page</h1>
        <p className="text-sm text-text-2 mt-1">
          Choose what customers see after they scan. Your printed QR code never changes.
        </p>
      </div>
      <HubEditor api={api} />
    </>
  );
}
