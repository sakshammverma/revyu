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
      <nav className="sticky top-0 z-20 -mx-3 px-3 sm:mx-0 sm:px-0 bg-[#f2f7f7]/95 backdrop-blur py-2">
        <Link
          href={`/r/${slug}`}
          className="inline-flex items-center gap-2 min-h-[44px] pr-3 text-sm font-semibold text-[#1a1e23] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff]"
        >
          <Icon name="back" className="w-5 h-5" />
          <span className="truncate max-w-[16rem]">{outlet.name}</span>
        </Link>
      </nav>
      <h1 className="font-display text-2xl leading-tight text-[#1a1e23]">{title}</h1>
      {children}
    </div>
  );
}

export function NeutralNotice({ name }: { name: string }) {
  return (
    <div className="v2-sheet border border-[#e8ecec] p-8 text-center">
      <h1 className="font-display text-xl text-[#1a1e23]">{name}</h1>
      <p className="mt-2 text-sm text-[#515a63]">This page isn&apos;t available right now. Thank you for stopping by!</p>
    </div>
  );
}
