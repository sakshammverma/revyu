import { Icon } from "@/components/hub/Icons";
import type { ExampleFeedback } from "@/lib/marketing/exampleDashboard";

function age(hours: number): string {
  return hours < 24 ? `${Math.max(1, hours)}h ago` : `${Math.round(hours / 24)}d ago`;
}

function LockIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}

function InertButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[var(--r-control)] border border-line-strong bg-sheet text-xs font-semibold text-ink cursor-default"
    >
      <Icon name={icon} className="w-4 h-4" />
      {label}
    </button>
  );
}

/**
 * The private feedback inbox, as a preview. CR-1: there are no message words at
 * all, not even made-up ones; each body is drawn as blurred bars behind a lock.
 */
export function FeedbackPreview({ items }: { items: ExampleFeedback[] }) {
  return (
    <section className="v2-sheet border border-line p-4 sm:p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-ink">Private feedback</h2>
          <p className="text-sm text-text-2 mt-0.5">Only you see these</p>
        </div>
        <span className="shrink-0 mt-1 inline-flex items-center rounded-full bg-accent-50 text-accent-hover px-2 py-0.5 text-xs font-semibold tabular-nums">
          {items.length} new
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-bg/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sheet border border-line px-2 py-0.5 text-xs font-semibold text-ink tabular-nums">
                <span aria-hidden className="text-star">★</span>
                <span aria-hidden>{item.rating}</span>
                <span className="sr-only">{item.rating} out of 5 stars</span>
              </span>
              <span className="text-xs text-text-2">{age(item.hoursAgo)}</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <LockIcon className="w-4 h-4 shrink-0 text-text-muted" />
              <div aria-hidden className="flex-1 flex flex-col gap-1.5 blur-[1.5px] select-none">
                <span className="block h-2.5 rounded-full bg-line-strong w-full" />
                <span className="block h-2.5 rounded-full bg-line-strong w-3/5" />
              </div>
              <span className="sr-only">Message hidden in this preview</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.hasPhone ? (
                <>
                  <InertButton icon="phone" label="Call back" />
                  <InertButton icon="whatsapp" label="WhatsApp" />
                </>
              ) : (
                <span className="text-xs text-text-2">No phone number left</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
