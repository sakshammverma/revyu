import { Skeleton } from "@/components/ui";

// Shown inside the app shell while a page's code loads, so a tap on the nav answers at once.
export default function PortalLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
