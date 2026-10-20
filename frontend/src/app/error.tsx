"use client";

import Link from "next/link";
import { useEffect } from "react";

// Any page outside /r (which has its own) that throws while rendering lands
// here instead of Next's default screen. The error is reported by
// instrumentation-client.ts / instrumentation.ts; the digest lets support match it to a log line.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div role="alert" className="v2-sheet border border-line w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl text-ink">Something went wrong</h1>
        <p className="text-sm text-text-2 mt-2">
          This page hit a problem. Try again, and if it keeps happening, contact us. Customers scanning your QR code are not affected.
        </p>
        <button onClick={() => retry()} className="btn-primary mt-5 min-h-[48px] w-full text-base">
          Try again
        </button>
        <Link href="/" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-hover underline">
          Go to the home page
        </Link>
        {error.digest && <p className="mt-4 text-xs text-text-muted">Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
