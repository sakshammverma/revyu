"use client";

import { Button } from "@/components/ui";

/**
 * Shown in place of a detailed dashboard view while the dashboard is locked.
 * The server refuses those views (402 DASHBOARD_LOCKED); this says why and how
 * to unlock, with the real count waiting where we have one (SRS-9.8).
 */
export function LockedNotice({ headline, body }: { headline: string; body: string }) {
  return (
    <section className="v2-card-elevated border border-accent/20 p-6 sm:p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Dashboard locked</p>
      <h2 className="font-display text-2xl text-ink mt-2">{headline}</h2>
      <p className="text-text-2 mt-2 max-w-md mx-auto">{body}</p>
      <Button href="/app/billing" className="mt-5 w-full sm:w-auto sm:min-w-[240px]">
        Unlock your dashboard
      </Button>
      <p className="text-xs text-text-2 mt-2">Your QR code keeps the same link after you pay.</p>
    </section>
  );
}
