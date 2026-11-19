"use client";

import Link from "next/link";
import { useState } from "react";

import { ageLabel, contactActions } from "@/components/dashboard/FeedbackInbox";
import { Icon } from "@/components/hub/Icons";
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
      <header className="flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-warning-50 border-b border-warning/20">
        <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-sheet text-warning flex items-center justify-center">
          <Icon name="mail" className="w-4 h-4" />
        </span>
        <h2 className="flex-1 min-w-0 font-semibold text-ink">
          <span className="tabular-nums">{waiting}</span> private {waiting === 1 ? "message needs" : "messages need"} a reply
        </h2>
        <Link
          href="/app/feedback"
          className="shrink-0 inline-flex items-center min-h-[44px] -my-2 text-sm font-semibold text-accent-hover hover:underline underline-offset-2"
        >
          <span className="hidden sm:inline">Open inbox</span>
          <span className="sm:hidden">Inbox</span>
          <span aria-hidden>&nbsp;→</span>
        </Link>
      </header>

      {/* The newest two (one on a phone), one line each: enough to act on, without pushing the numbers off screen. */}
      <ul className="divide-y divide-line">
        {shown.slice(0, 2).map((item, i) => {
          const actions = item.contact ? contactActions(item.contact) : [];
          return (
            <li key={item.id} className={`px-4 sm:px-5 py-2.5 flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${i > 0 ? "hidden sm:flex" : "flex"}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink line-clamp-2 sm:line-clamp-1 break-words">{item.message}</p>
                <p className="text-xs text-text-2 mt-0.5 tabular-nums truncate">
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
                    className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[34px] px-3 rounded-[var(--r-control)] bg-accent-50 text-accent-hover text-sm font-semibold hover:bg-accent/15"
                  >
                    {a.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setResolved(item.id, true)}
                  className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[34px] px-3 rounded-[var(--r-control)] border border-line-strong bg-sheet text-sm font-semibold text-ink hover:bg-paper-subtle cursor-pointer"
                >
                  Mark resolved
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {elsewhere > 0 && shown.length === 0 && (
        <p className="px-4 sm:px-5 py-2.5 text-xs text-text-2">{elsewhere} waiting in your inbox.</p>
      )}
    </section>
  );
}
