"use client";

import { useState } from "react";

import { Button, Card, EmptyState, ErrorState, Skeleton, ToastProvider, useToast } from "@/components/ui";
import { listPendingSends, resolvePendingSend, type PendingSend } from "@/lib/admin/api";
import { useAsync } from "@/lib/useAsync";

const LABEL: Record<string, string> = {
  trial_threshold: "Trial numbers: pay now",
  credits_low: "3 credits left",
  collection_paused: "Collection paused",
  payment_failed: "Payment failed",
  zero_scan_nudge: "No scans in a week",
};

export function PendingSendsView() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

function Inner() {
  const { data, error, reload } = useAsync(listPendingSends, []);
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(item: PendingSend, action: "sent" | "dismiss") {
    setBusy(item.id);
    try {
      await resolvePendingSend(item.id, action);
      toast(action === "sent" ? "Marked as sent" : "Dismissed");
      reload();
    } catch {
      toast("Couldn't update that message.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message="Couldn't load the queue. Check your admin token." onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 max-w-3xl mx-auto" />;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <p className="text-sm text-text-2">
        Pre-written WhatsApp messages for the moments that matter. Tap <strong className="text-ink">Open WhatsApp</strong>, press send, then come back and mark it sent.
        Nothing here sends automatically.
      </p>

      {data.length === 0 ? (
        <Card>
          <EmptyState icon="✓" title="Nothing to send" body="Queued messages appear when a trial ends, a payment fails or an outlet has no scans." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {item.business_name ?? "Outlet"} <span className="text-text-2 font-normal">· {item.owner_name ?? item.to_phone}</span>
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">{LABEL[item.template] ?? item.template}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-text-2 whitespace-pre-wrap bg-paper-subtle/50 rounded-xl border border-line p-3">{item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-[var(--r-control)] bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
                  >
                    Open WhatsApp ↗
                  </a>
                  <Button variant="secondary" loading={busy === item.id} onClick={() => resolve(item, "sent")}>
                    Mark sent
                  </Button>
                  <Button variant="ghost" disabled={busy === item.id} onClick={() => resolve(item, "dismiss")}>
                    Dismiss
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
