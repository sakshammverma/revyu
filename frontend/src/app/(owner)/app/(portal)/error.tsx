"use client";

import { useEffect } from "react";

import { Button, ErrorState } from "@/components/ui";

// A render error inside the portal keeps the sidebar and tab bar; only the page area is replaced.
// `retry` is this Next version's name for the reset callback.
export default function PortalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3">
      <ErrorState message="Something went wrong loading this page." onRetry={retry} />
      <Button href="/app" variant="secondary">
        Back to overview
      </Button>
    </div>
  );
}
