"use client";

import { FeedbackInbox } from "@/components/dashboard/FeedbackInbox";
import { useOwner } from "@/components/portal/OwnerContext";
import { ErrorState, Skeleton } from "@/components/ui";
import { getFeedbackInbox } from "@/lib/dashboard/api";
import { useAsync } from "@/lib/useAsync";

export default function FeedbackPage() {
  const { outlet } = useOwner();
  const { data, error, reload } = useAsync(() => getFeedbackInbox(outlet.outlet_id), [outlet.outlet_id]);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Feedback</h1>
        <p className="text-sm text-text-2 mt-1">Answer quickly. It&rsquo;s the cheapest way to keep a customer.</p>
      </div>
      {error ? (
        <ErrorState message="We couldn't load your feedback." onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <FeedbackInbox items={data.items} />
      )}
    </>
  );
}
