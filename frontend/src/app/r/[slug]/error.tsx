"use client";

import { useEffect } from "react";

// C-6: the customer flow must never present a stack trace or a dead end.
// `retry` is this Next version's name for the reset callback.
export default function FlowError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-start sm:items-center justify-center px-3 pt-8">
      <div role="alert" className="v2-sheet border border-line w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl text-ink">Just a moment</h1>
        <p className="text-sm text-text-2 mt-2">We couldn&rsquo;t load this page. Please check your connection and try again.</p>
        <button
          onClick={() => retry()}
          className="btn-primary mt-5 min-h-[48px] w-full text-base"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
