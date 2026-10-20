"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card } from "@/components/ui";

// Shown on Overview until the first scan: the QR itself, a way to get it to a print
// shop from a phone, and the three things worth doing before it is on a counter.
export function FirstRunCard({ outletId, slug }: { outletId: string; slug: string }) {
  const qrUrl = `/api/app/outlets/${outletId}/qr?format=png`;
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    setSharing(true);
    setNote(null);
    try {
      const blob = await (await fetch(qrUrl, { credentials: "include" })).blob();
      const file = new File([blob], "revyu-qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Revyu QR code" });
      } else {
        setNote("Sharing isn’t available on this device. Use Download instead.");
      }
    } catch (e) {
      // The share sheet being dismissed is not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("We couldn’t share that. Use Download instead.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Card title="Get your first review" description="Your QR code is ready. Print it, put it where customers pay or wait, and it starts working.">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="Your Revyu QR code"
          width={160}
          height={160}
          className="w-40 h-40 rounded-xl border border-line bg-white p-2 shrink-0"
        />
        <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button href={`/app/qr`}>Download &amp; print</Button>
            <Button variant="secondary" onClick={share} loading={sharing}>
              Send to my print shop
            </Button>
          </div>
          {note && (
            <p role="status" className="text-sm text-text-2">
              {note}
            </p>
          )}
          <ol className="flex flex-col gap-2 text-sm text-ink list-decimal pl-5">
            <li>
              <Link href="/app/qr" className="font-semibold underline underline-offset-2">
                Print it
              </Link>{" "}
              as a counter standee, a sticker or a receipt footer.
            </li>
            <li>
              <a href={`/r/${slug}?preview=1`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                Open your page on your phone
              </a>{" "}
              to see what customers see. Tapping through it yourself counts in your numbers, so try it once.
            </li>
            <li>
              <Link href="/app/hub" className="font-semibold underline underline-offset-2">
                Add your links, menu or rewards
              </Link>{" "}
              so customers can do more than review.
            </li>
          </ol>
        </div>
      </div>
    </Card>
  );
}
