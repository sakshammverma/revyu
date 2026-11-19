"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Button, Card } from "@/components/ui";

type StepId = "print" | "test" | "place" | "hub";
const STEPS: StepId[] = ["print", "test", "place", "hub"];

const storageKey = (outletId: string) => `revyu:setup:${outletId}`;

function readDone(outletId: string): Set<StepId> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(outletId)) ?? "[]");
    return new Set((Array.isArray(raw) ? raw : []).filter((s): s is StepId => STEPS.includes(s)));
  } catch {
    return new Set();
  }
}

// Shown on Overview until the first scan: the QR itself, a way to get it to a print
// shop from a phone, and the things worth doing before it is on a counter. Progress
// is kept per device; it is a guide, not a gate.
export function FirstRunCard({ outletId, slug, businessName }: { outletId: string; slug: string; businessName: string }) {
  const qrUrl = `/api/app/outlets/${outletId}/qr?format=png`;
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [welcome, setWelcome] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // Browser-only state (localStorage, URL, share support), read once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(readDone(outletId));
    setCanShare(typeof navigator.share === "function");
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "1") {
      setWelcome(true);
      // A refresh shouldn't greet them again.
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [outletId]);

  function mark(step: StepId) {
    setDone((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev).add(step);
      try {
        localStorage.setItem(storageKey(outletId), JSON.stringify([...next]));
      } catch {
        // Private mode: progress just isn't remembered.
      }
      return next;
    });
  }

  async function share() {
    setSharing(true);
    setNote(null);
    try {
      const blob = await (await fetch(qrUrl, { credentials: "include" })).blob();
      const file = new File([blob], "revyu-qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${businessName} QR code` });
        mark("print");
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

  const count = STEPS.filter((s) => done.has(s)).length;
  const pct = Math.round((count / STEPS.length) * 100);

  return (
    <Card>
      {welcome && (
        <div role="status" className="-mx-1 mb-5 rounded-xl bg-success-50 border border-success/25 px-4 py-3">
          <p className="font-semibold text-success-strong">Welcome to Revyu. {businessName} is live.</p>
          <p className="text-sm text-text-2 mt-0.5">Four quick steps and your first review can come in today.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center gap-3 md:w-48 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR code for ${businessName}`}
            width={176}
            height={176}
            className="w-44 h-44 rounded-xl border border-line bg-white p-2"
          />
          <a
            href={qrUrl}
            download="revyu-qr.png"
            onClick={() => mark("print")}
            className="text-sm font-semibold text-accent-hover underline underline-offset-2 min-h-[44px] inline-flex items-center"
          >
            Download QR image
          </a>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Set up your QR</h2>
            <span className="text-sm text-text-2 tabular-nums">
              {count} of {STEPS.length} done
            </span>
          </div>
          <div
            className="mt-2 h-2 rounded-full bg-paper-subtle overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Setup progress"
          >
            <div className="h-full bg-accent rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>

          <ol className="mt-4 flex flex-col divide-y divide-line">
            <SetupStep n={1} done={done.has("print")} title="Get it printed" body="A counter standee, handout cards, a sticker or a receipt footer. Print files are ready to send.">
              <Button href="/app/qr" onClick={() => mark("print")}>
                Print files
              </Button>
              {canShare && (
                <Button variant="secondary" onClick={share} loading={sharing}>
                  Send to my print shop
                </Button>
              )}
            </SetupStep>
            <SetupStep n={2} done={done.has("test")} title="See what customers see" body="Open your page on your phone. Preview mode doesn’t count in your numbers.">
              <a
                href={`/r/${slug}?preview=1`}
                target="_blank"
                rel="noreferrer"
                onClick={() => mark("test")}
                className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-[var(--r-control)] border border-line-strong bg-sheet text-sm font-semibold text-ink hover:border-accent"
              >
                Open my page ↗
              </a>
            </SetupStep>
            <SetupStep n={3} done={done.has("place")} title="Put it where people pay or wait" body="Eye level at the payment counter gets the most scans. Never offer anything in return for a review.">
              <Button variant="secondary" onClick={() => mark("place")} disabled={done.has("place")}>
                {done.has("place") ? "Placed" : "I’ve placed it"}
              </Button>
            </SetupStep>
            <SetupStep n={4} done={done.has("hub")} title="Add your links, menu or rewards" body="Optional. Gives customers more to do after they scan.">
              <Button variant="ghost" href="/app/hub" onClick={() => mark("hub")}>
                Set up
              </Button>
            </SetupStep>
          </ol>
          {note && (
            <p role="status" className="text-sm text-text-2 mt-2">
              {note}
            </p>
          )}
          {count === STEPS.length && (
            <p role="status" className="mt-3 text-sm font-semibold text-success-strong">
              All set. Your numbers appear here after the first scan.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function SetupStep({ n, done, title, body, children }: { n: number; done: boolean; title: string; body: string; children: ReactNode }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0 flex gap-3">
      <span
        className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
          done ? "bg-accent border-accent text-white" : "border-line-strong text-text-2"
        }`}
      >
        {done ? (
          <svg aria-hidden viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span aria-hidden>{n}</span>
        )}
        <span className="sr-only">{done ? "Done:" : `Step ${n}:`}</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${done ? "text-text-2 line-through decoration-1" : "text-ink"}`}>{title}</p>
        <p className="text-sm text-text-2 mt-0.5">{body}</p>
        <div className="mt-3 flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
      </div>
    </li>
  );
}
