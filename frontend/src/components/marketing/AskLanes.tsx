import type { CSSProperties } from "react";

/**
 * The page's central claim, moving: asking by memory reaches a few customers,
 * a code on the counter reaches everyone who walks past it. It shows who gets
 * *asked*, never who reviews; nothing here promises an outcome.
 */

const DOTS = Array.from({ length: 9 }, (_, i) => i);
// By memory, the owner happens to ask these two.
const REMEMBERED = new Set([2, 7]);

function Lane({ title, sub, result, everyone }: { title: string; sub: string; result: string; everyone: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 sm:p-5 text-left shadow-v2-rest ${everyone ? "border-accent/40" : "border-line"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className={`text-xs font-semibold ${everyone ? "text-accent-hover" : "text-text-2"}`}>{result}</p>
      </div>
      <p className="mt-0.5 text-[13px] text-text-2">{sub}</p>

      <div aria-hidden className="al-track mt-4">
        {/* The moment of asking, mid-way along the counter */}
        <span className={`al-gate ${everyone ? "al-gate-code" : ""}`}>
          {everyone ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M4 4h7v7H4zm2 2v3h3V6zM13 4h7v7h-7zm2 2v3h3V6zM4 13h7v7H4zm2 2v3h3v-3zM13 13h3v3h-3zM17 17h3v3h-3zM17 13h3v2h-3zM13 18h2v2h-2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <circle cx="12" cy="8" r="3.500" />
              <path d="M5 20c.700-3.700 3.400-5.500 7-5.500s6.300 1.800 7 5.500" />
            </svg>
          )}
        </span>
        {DOTS.map((i) => {
          const asked = everyone || REMEMBERED.has(i);
          return (
            <span
              key={i}
              style={{ "--i": i } as CSSProperties}
              className={`al-dot ${asked ? "al-asked" : ""} ${asked && i >= 5 ? "al-past" : ""}`}
            />
          );
        })}
      </div>
      <div aria-hidden className="mt-2 flex justify-between text-[11px] text-text-muted">
        <span>walks in</span>
        <span>{everyone ? "passes your code" : "you, mid-rush"}</span>
        <span>walks out</span>
      </div>
    </div>
  );
}

export function AskLanes() {
  return (
    <figure className="mt-10 border-t border-line pt-10 sm:mt-12 sm:pt-12">
      <div className="grid gap-4 sm:grid-cols-2">
        <Lane title="Asking by memory" sub="You ask when you remember, and when it isn’t busy." result="A few get asked" everyone={false} />
        <Lane title="A code on the counter" sub="It is there for every customer, every day." result="Everyone gets asked" everyone />
      </div>
      <figcaption className="mt-3 text-xs text-text-muted">
        An illustration of who gets asked. Whether they write a review is always their choice.
      </figcaption>
    </figure>
  );
}
