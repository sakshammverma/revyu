import Link from "next/link";

import { Icon } from "@/components/hub/Icons";
import type { OutletHead } from "@/lib/hub/api";

// Every module page has a one-tap route back to the hub (FR-84).
export function ModuleShell({
  slug,
  outlet,
  title,
  children,
}: {
  slug: string;
  outlet: OutletHead;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="sticky top-0 z-20 -mx-3 px-3 sm:mx-0 sm:px-0 bg-bg/95 backdrop-blur py-2">
        <Link
          href={`/r/${slug}`}
          className="inline-flex items-center gap-2 min-h-[44px] pr-3 text-sm font-semibold text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="back" className="w-5 h-5" />
          <span className="truncate max-w-[16rem]">{outlet.name}</span>
        </Link>
      </nav>
      <h1 className="font-display text-2xl leading-tight text-ink">{title}</h1>
      {children}
    </div>
  );
}

export function NeutralNotice({ name }: { name: string }) {
  return (
    <div className="v2-sheet border border-line p-8 text-center">
      <h1 className="font-display text-xl text-ink">{name}</h1>
      <p className="mt-2 text-sm text-text-2">This page isn&apos;t available right now. Thank you for stopping by!</p>
    </div>
  );
}
