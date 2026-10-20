"use client";

import { FeedbackInbox } from "@/components/dashboard/FeedbackInbox";
import { LockedNotice } from "@/components/portal/LockedNotice";
import { useOwner } from "@/components/portal/OwnerContext";
import { ErrorState, Skeleton } from "@/components/ui";
import { getFeedbackInbox, getOverview, isDashboardLocked } from "@/lib/dashboard/api";
import { useAsync } from "@/lib/useAsync";

export default function FeedbackPage() {
  const { outlet } = useOwner();
  const locked = isDashboardLocked(outlet.state);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Feedback</h1>
        <p className="text-sm text-text-2 mt-1">Answer quickly. It&rsquo;s the cheapest way to keep a customer.</p>
      </div>
      {locked ? <LockedFeedback outletId={outlet.outlet_id} /> : <Inbox outletId={outlet.outlet_id} />}
    </>
  );
}

function Inbox({ outletId }: { outletId: string }) {
  const { data, error, reload } = useAsync(() => getFeedbackInbox(outletId), [outletId]);
  if (error) return <ErrorState message="We couldn't load your feedback." onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;
  return <FeedbackInbox items={data.items} />;
}

function LockedFeedback({ outletId }: { outletId: string }) {
  // The overview stays readable while locked, and carries the message count.
  const { data } = useAsync(() => getOverview(outletId), [outletId]);
  const n = data?.feedback_count;
  return (
    <LockedNotice
      headline={
        n === undefined
          ? "Your private feedback is waiting"
          : n === 0
            ? "No private messages yet"
            : `${n} private ${n === 1 ? "message is" : "messages are"} waiting`
      }
      body="Customers who tell you privately what went wrong are giving you a chance to fix it. Unlock to read and answer them."
    />
  );
}
