"use client";

import { Standee3D } from "@/components/marketing/Standee3D";
import { VIA_DECK, type SalesKit } from "@/lib/marketing/salesTypes";

const CHIPS = ["Customers tap, they don't type", "The draft comes only from their taps", "Google button at every star rating"];

/** The try link on this device: same origin as the deck, flagged so its last screen links back. */
function tryHref(url: string): string {
  try {
    return `${new URL(url).pathname}?via=${VIA_DECK}`;
  } catch {
    return url;
  }
}

/**
 * Step 2: their counter standee with a real code that opens the customer page in their name.
 * The owner scans it with their own phone; "Try it on this phone" opens it here instead.
 */
export function TrySlide({ kit, name }: { kit: SalesKit; name: string }) {
  return (
    <div className="marketing-root mx-auto flex h-full max-w-4xl flex-col items-center justify-center-safe gap-3 px-5 py-3 sm:flex-row sm:gap-12 sm:px-8 sm:py-10">
      <div className="text-center sm:order-2 sm:flex-1 sm:text-left">
        <h1 className="font-display text-[1.6rem] leading-[1.15] tracking-tight text-ink sm:text-5xl">
          This goes on your counter.
        </h1>
        <p className="mt-1 text-sm text-text-2 sm:mt-3 sm:text-lg">Scan it with your phone camera.</p>

        <ul className="mt-3 hidden flex-wrap gap-2 sm:mt-6 sm:flex">
          {CHIPS.map((c) => (
            <li key={c} className="rounded-full border border-line bg-sheet px-3 py-1.5 text-sm text-ink">
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-6 hidden sm:block">
          <a
            href={tryHref(kit.try.url)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-control)] border border-line-strong bg-sheet px-5 text-sm font-semibold text-ink hover:bg-paper-subtle"
          >
            Try it on this phone
          </a>
          <p className="mt-3 text-xs text-text-muted">Demo link works for 3 hours. Nothing is recorded.</p>
        </div>
      </div>

      {/* Full size and face-on at every width: the owner scans this code off the screen. */}
      <div className="shrink-0 sm:order-1">
        <Standee3D
          flat
          qrPath={kit.try.qr.d}
          qrSize={kit.try.qr.size}
          label={`QR code: open ${name}'s customer page`}
          name={name}
          headline="Scan to share your experience"
          cta="Scan with your phone camera"
        />
      </div>

      {/* On phones the chips are left out to give the code its full size; the presenter says them. */}
      <div className="flex w-full flex-col items-center gap-2 sm:hidden">
        <a
          href={tryHref(kit.try.url)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-control)] border border-line-strong bg-sheet px-5 text-sm font-semibold text-ink hover:bg-paper-subtle"
        >
          Try it on this phone
        </a>
        <p className="text-xs text-text-muted">Demo link works for 3 hours. Nothing is recorded.</p>
      </div>
    </div>
  );
}
