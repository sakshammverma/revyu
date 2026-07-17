"use client";

import { useState } from "react";

import { Card, EmptyState, useToast } from "@/components/ui";
import { resolveFeedback, type FeedbackItem } from "@/lib/dashboard/api";

type Filter = "open" | "resolved" | "all";

function ageLabel(iso: string, now: number): string {
  const hours = (now - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Tel/WhatsApp quick-actions when the customer left something diallable. */
function contactActions(contact: string) {
  const digits = contact.replace(/[^\d+]/g, "");
  const isPhone = digits.replace(/\D/g, "").length >= 8 && !contact.includes("@");
  if (isPhone) {
    const wa = digits.replace(/^\+/, "");
    return [
      { href: `tel:${digits}`, label: "Call" },
      { href: `https://wa.me/${wa}`, label: "WhatsApp" },
    ];
  }
  if (contact.includes("@")) return [{ href: `mailto:${contact}`, label: "Email" }];
  return [];
}

export function FeedbackInbox({ items: initialItems }: { items: FeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("open");
  const { toast } = useToast();
  const [now] = useState(() => Date.now());

  async function setResolved(id: string, resolved: boolean, offerUndo = true) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved } : i)));
    try {
      await resolveFeedback(id, resolved);
      toast(resolved ? "Marked as resolved" : "Reopened", {
        ...(offerUndo && { actionLabel: "Undo", onAction: () => setResolved(id, !resolved, false) }),
      });
    } catch {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: !resolved } : i)));
      toast("Couldn't save that change. Please try again.", { tone: "error" });
    }
  }

  const openCount = items.filter((i) => !i.resolved).length;
  const shown = items.filter((i) => (filter === "all" ? true : filter === "open" ? !i.resolved : i.resolved));

  return (
    <Card
      title="Private customer feedback"
      description="Messages customers sent only to you, at any rating."
      action={
        <div role="tablist" aria-label="Filter feedback" className="inline-flex rounded-[var(--r-control)] bg-paper-subtle p-1 shrink-0">
          {(["open", "resolved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 min-h-[36px] rounded-md text-xs font-semibold capitalize cursor-pointer ${
                filter === f ? "bg-sheet text-ink shadow-v2-rest" : "text-text-2"
              }`}
            >
              {f}
              {f === "open" && openCount > 0 && <span className="ml-1.5 text-accent-hover tabular-nums">{openCount}</span>}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={filter === "open" && items.length > 0 ? "🎉" : "💬"}
          title={
            filter === "open" && items.length > 0
              ? "Inbox zero. Every message is resolved."
              : items.length === 0
                ? "No private feedback yet"
                : "Nothing here"
          }
          body={
            items.length === 0
              ? "When a customer sends you a private message, it appears here and we email you straight away."
              : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((item) => {
            const actions = item.contact ? contactActions(item.contact) : [];
            const stale = !item.resolved && now - new Date(item.created_at).getTime() > 48 * 3_600_000;
            return (
              <li
                key={item.id}
                className={`p-4 sm:p-5 rounded-xl border transition-colors ${
                  item.resolved ? "bg-paper-subtle/50 border-line" : "bg-sheet border-line shadow-v2-rest"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-warning-50 border border-warning/25 text-warning tabular-nums text-xs font-bold">
                      {item.rating ? `${item.rating}★` : "No rating"}
                    </span>
                    <span className={`text-xs tabular-nums ${stale ? "text-alert font-semibold" : "text-text-2"}`}>
                      {ageLabel(item.created_at, now)}
                      {stale && " · waiting 2+ days"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResolved(item.id, !item.resolved)}
                    className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold px-3 rounded-lg border border-line-strong bg-sheet text-text-2 hover:bg-paper-subtle hover:text-ink cursor-pointer"
                  >
                    {item.resolved ? "Reopen" : "Mark resolved"}
                  </button>
                </div>

                <p className="text-sm sm:text-base text-ink mt-3 leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>

                {item.contact && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2 text-sm text-text-2">
                    <span>
                      <span className="font-semibold text-ink">Contact:</span> {item.contact}
                    </span>
                    {actions.map((a) => (
                      <a
                        key={a.label}
                        href={a.href}
                        target={a.href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-accent-50 text-accent-hover text-xs font-semibold hover:bg-accent/15"
                      >
                        {a.label}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
