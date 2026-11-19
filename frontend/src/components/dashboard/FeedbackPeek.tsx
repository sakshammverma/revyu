"use client";

import Link from "next/link";
import { useState } from "react";

import { ageLabel, contactActions } from "@/components/dashboard/FeedbackInbox";
import { useToast } from "@/components/ui";
import { resolveFeedback, type FeedbackItem } from "@/lib/dashboard/api";

/**
 * The newest unanswered private messages, on the Overview itself: read, call or
 * message the customer, and mark it resolved without opening the inbox. Shown
 * only when something is waiting.
 */
export function FeedbackPeek({ items, openCount }: { items: FeedbackItem[]; openCount: number }) {
  const { toast } = useToast();
  const [now] = useState(() => Date.now());
  const [done, setDone] = useState<Set<string>>(new Set());

  const mark = (id: string, resolved: boolean) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (resolved) next.add(id);
      else next.delete(id);
      return next;
    });

  async function setResolved(id: string, resolved: boolean, offerUndo = true) {
    mark(id, resolved);
    try {
      await resolveFeedback(id, resolved);
      toast(resolved ? "Marked as resolved" : "Reopened", {
        ...(offerUndo && { actionLabel: "Undo", onAction: () => setResolved(id, !resolved, false) }),
      });
    } catch {
      mark(id, !resolved);
      toast("Couldn't save that change. Please try again.", { tone: "error" });
    }
  }

  const shown = items.filter((i) => !done.has(i.id));
  const waiting = openCount - (items.length - shown.length);
  if (waiting <= 0) return null;
  const elsewhere = waiting - shown.length;

  return (
    <section className="v2-sheet border border-warning/30 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-warning-50 border-b border-warning/20">
        <h2 className="font-semibold text-ink">
          <span className="tabular-nums">{waiting}</span> private {waiting === 1 ? "message needs" : "messages need"} a reply
        </h2>
        <Link
          href="/app/feedback"
          className="shrink-0 inline-flex items-center min-h-[44px] -my-2 text-sm font-semibold text-accent-hover hover:underline underline-offset-2"
        >
          Open inbox<span aria-hidden>&nbsp;→</span>
        </Link>
      </header>

      <ul className="divide-y divide-line">
        {shown.map((item) => {
          const actions = item.contact ? contactActions(item.contact) : [];
          return (
            <li key={item.id} className="px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink leading-relaxed line-clamp-2 break-words">{item.message}</p>
                <p className="text-xs text-text-2 mt-1 tabular-nums">
                  {item.rating ? `${item.rating}★ · ` : ""}
                  {ageLabel(item.created_at, now)}
                  {item.contact ? ` · ${item.contact}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {actions.map((a) => (
                  <a
                    key={a.label}
                    href={a.href}
                    target={a.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[36px] px-3 rounded-[var(--r-control)] bg-accent-50 text-accent-hover text-sm font-semibold hover:bg-accent/15"
                  >
                    {a.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setResolved(item.id, true)}
                  className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[36px] px-3 rounded-[var(--r-control)] border border-line-strong bg-sheet text-sm font-semibold text-ink hover:bg-paper-subtle cursor-pointer"
                >
                  Mark resolved
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {elsewhere > 0 && (
        <p className="px-4 sm:px-6 py-2.5 border-t border-line text-xs text-text-2">
          {shown.length > 0 ? `${elsewhere} more in your inbox.` : `${elsewhere} waiting in your inbox.`}
        </p>
      )}
    </section>
  );
}
