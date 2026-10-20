import { Button, EmptyState } from "@/components/ui";

export default function PortalNotFound() {
  return (
    <EmptyState
      title="We couldn't find that page"
      body="It may have moved, or the link is out of date."
      action={<Button href="/app">Back to overview</Button>}
    />
  );
}
