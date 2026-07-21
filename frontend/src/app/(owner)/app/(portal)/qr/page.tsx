"use client";

import { AssetsPanel } from "@/components/dashboard/AssetsPanel";
import { PrintKitCard } from "@/components/dashboard/PrintKitCard";
import { useOwner } from "@/components/portal/OwnerContext";
import { Card } from "@/components/ui";

const TIPS = [
  { title: "At the payment counter", body: "Everyone waits here. A standee at eye level gets the most scans." },
  { title: "On the receipt or bill", body: "The receipt footer goes home with every customer, so it works after they leave." },
  { title: "Handed over with the bill", body: "Hand the card over and say nothing more. Never offer anything in return for a review." },
];

export default function QrPage() {
  const { outlet } = useOwner();
  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">QR &amp; print</h1>
        <p className="text-sm text-text-2 mt-1">Your QR code never changes, so printed copies keep working.</p>
      </div>

      <AssetsPanel outletId={outlet.outlet_id} state={outlet.state} />
      <PrintKitCard />

      <Card title="Where to place it" description="Placement decides how many people scan.">
        <ol className="grid gap-3 sm:grid-cols-3">
          {TIPS.map((t, i) => (
            <li key={t.title} className="rounded-xl border border-line bg-paper-subtle/40 p-4">
              <span aria-hidden className="text-xs font-bold text-accent-hover">
                0{i + 1}
              </span>
              <p className="font-semibold text-ink mt-1">{t.title}</p>
              <p className="text-sm text-text-2 mt-1">{t.body}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-text-2 mt-4">
          Printed placement only. Please don&rsquo;t put a tablet or kiosk at the counter, and don&rsquo;t watch customers
          while they review.
        </p>
      </Card>
    </>
  );
}
