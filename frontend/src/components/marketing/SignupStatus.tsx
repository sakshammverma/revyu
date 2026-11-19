"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSignupStatus, SignupNotFoundError } from "@/lib/signup/api";
import { Skeleton, StatusPill } from "@/components/ui";

interface Props {
  signupId: string;
  /** Arrived straight from checkout: a pending payment is still being confirmed, not missing. */
  justPaid?: boolean;
}

const POLL_INTERVAL_MS = 10_000;
// Right after checkout the webhook may be seconds away; check sooner.
const FAST_POLL_MS = 3_000;
const FAST_POLLS = 10;
/** States that can still change on their own (payment or founder approval pending). */
const WAITING = new Set(["draft", "pending_payment", "pending_approval"]);
const MAX_FAILURES = 3;

type Step = "done" | "current" | "todo" | "failed";

export function SignupStatus({ signupId, justPaid = false }: Props) {
  const [status, setStatus] = useState<{ state: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<"not_found" | "network" | null>(null);

  // Poll while the outcome is pending; stop once it's decided, on a 404, or
  // after repeated failures, and skip ticks while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => (justPaid && ++polls <= FAST_POLLS ? FAST_POLL_MS : POLL_INTERVAL_MS);
    async function poll() {
      if (document.hidden) {
        timer = setTimeout(poll, next());
        return;
      }
      try {
        const s = await fetchSignupStatus(signupId);
        if (cancelled) return;
        failures = 0;
        setLoadError(null);
        setStatus({ state: s.state, message: s.message });
        if (!WAITING.has(s.state)) return;
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SignupNotFoundError) {
          setLoadError("not_found");
          return;
        }
        if (++failures >= MAX_FAILURES) setLoadError("network");
      }
      timer = setTimeout(poll, next());
    }
    // Come back to the tab after approval: check at once rather than on the next tick.
    function onVisible() {
      if (document.hidden || cancelled) return;
      clearTimeout(timer);
      poll();
    }
    poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signupId, justPaid]);

  if (loadError === "not_found") {
    return (
      <div role="alert" className="max-w-xl mx-auto v2-sheet border border-line p-6 sm:p-10 text-center">
        <h2 className="font-display text-2xl text-ink">We can&rsquo;t find that application</h2>
        <p className="mt-2 text-sm text-text-2">Check the link in your email, or start again. Nothing has been charged for an application we can&rsquo;t find.</p>
        <Link href="/signup" className="btn-primary mt-5 inline-flex min-h-[44px] items-center">
          Start signup
        </Link>
      </div>
    );
  }

  if (!status && loadError === "network") {
    return (
      <div role="alert" className="max-w-xl mx-auto v2-sheet border border-line p-6 sm:p-10 text-center">
        <h2 className="font-display text-2xl text-ink">We can&rsquo;t load your application right now</h2>
        <p className="mt-2 text-sm text-text-2">This page will keep trying. Your application and any payment are safe; you can also refresh in a few minutes.</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-xl mx-auto v2-sheet border border-line p-6 sm:p-10" aria-busy="true" aria-label="Loading your application">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full mt-6" />
        <Skeleton className="h-8 w-3/4 mt-6" />
      </div>
    );
  }

  const { state, message } = status;
  const confirming = state === "pending_payment" && justPaid;
  const live = !WAITING.has(state) && state !== "rejected";
  const steps: { label: string; detail: string; step: Step }[] = [
    {
      label: "Payment",
      detail: confirming ? "Confirming with your bank" : state === "pending_payment" ? "Not received yet" : "Authorised",
      step: state === "pending_payment" ? "current" : "done",
    },
    {
      label: "Verification",
      detail: state === "rejected" ? "Not approved" : state === "pending_approval" ? "Usually a few hours" : live ? "Verified" : "Next",
      step: state === "rejected" ? "failed" : state === "pending_approval" ? "current" : live ? "done" : "todo",
    },
    { label: "QR live", detail: live ? "Ready to print" : "Then you print", step: live ? "done" : "todo" },
  ];
  const pill = live
    ? { tone: "success" as const, label: "Live" }
    : state === "rejected"
      ? { tone: "alert" as const, label: "Not approved" }
      : confirming
        ? { tone: "info" as const, label: "Confirming payment" }
        : state === "pending_payment"
          ? { tone: "warning" as const, label: "Awaiting payment" }
          : { tone: "info" as const, label: "Verifying" };

  return (
    <div className="max-w-xl mx-auto v2-sheet border border-line p-5 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-line">
        <span className="font-mono text-xs uppercase tracking-wider text-text-2">Application #{signupId.slice(0, 8)}</span>
        <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Signup progress">
        {steps.map((s, i) => (
          <li key={s.label} className="flex flex-col items-center text-center min-w-0" aria-current={s.step === "current" ? "step" : undefined}>
            <div className="relative w-full flex justify-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-1/2 -translate-y-1/2 w-[calc(100%+0.5rem)] h-0.5 ${s.step === "todo" ? "bg-line" : "bg-accent"}`}
                />
              )}
              <StepDot step={s.step} n={i + 1} />
            </div>
            <span className="mt-2 text-sm font-semibold text-ink">{s.label}</span>
            <span className="text-xs text-text-2">{s.detail}</span>
          </li>
        ))}
      </ol>

      {loadError === "network" && (
        <p role="status" className="mt-5 text-sm text-alert">
          We&rsquo;re having trouble checking for updates. This page will keep trying; you can also refresh it.
        </p>
      )}

      <div className="mt-6" aria-live="polite">
        <h2 className="font-display text-2xl sm:text-[28px] leading-snug tracking-tight text-ink">
          {confirming ? "Payment authorised. Confirming it with Razorpay." : message}
        </h2>

        {confirming && (
          <Panel>
            This usually takes a few seconds. <strong className="text-ink">Don&rsquo;t pay again.</strong> If this page hasn&rsquo;t
            moved on in a few minutes,{" "}
            <Link href="/contact" className="font-semibold text-accent-hover hover:underline">
              contact us
            </Link>{" "}
            and quote your application number.
          </Panel>
        )}

        {state === "pending_payment" && !confirming && (
          <Panel>
            We haven&rsquo;t received your payment authorisation yet. Nothing has been charged.{" "}
            <Link href="/signup" className="font-semibold text-accent-hover hover:underline">
              Return to signup
            </Link>{" "}
            to try again. Your details are kept.
          </Panel>
        )}

        {state === "pending_approval" && (
          <>
            <Panel>
              We check your business against the Google listing you picked, so customer reviews always land on your real
              profile. We&rsquo;ve emailed you a confirmation, and we&rsquo;ll email again the moment your QR is ready.{" "}
              <strong className="text-ink">You can close this page.</strong>
            </Panel>
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink">Get ready while you wait</p>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-text-2">
                <Tip>Pick the spot: the payment counter or waiting area gets the most scans.</Tip>
                <Tip>Find a print shop nearby. A standee and a stack of cards cost very little.</Tip>
                <Tip>Tell your team the QR is coming. They only need to point at it, never ask for a review.</Tip>
              </ul>
            </div>
          </>
        )}

        {live && (
          <div className="mt-4 p-5 rounded-xl bg-success-50 border border-success/25 text-sm leading-relaxed">
            <p className="font-semibold text-success-strong text-base">Your QR code is ready.</p>
            <p className="mt-1 text-text-2">
              Your dashboard has your QR, print files (receipt footer, handout card, counter standee, sticker) and a short
              setup checklist. We&rsquo;ve also emailed you a one-tap login link.
            </p>
            {/* A full load: inside the owner portal this screen is already at /app. */}
            <a href="/app?welcome=1" className="btn-primary mt-4 w-full sm:w-auto min-h-[48px] justify-center">
              Open my dashboard →
            </a>
          </div>
        )}

        {state === "rejected" && (
          <div className="mt-4 p-4 rounded-xl bg-alert-50 border border-alert/20 text-sm text-text-2 leading-relaxed">
            If you think this is a mistake, reply to our email or{" "}
            <Link href="/contact" className="font-semibold text-accent-hover hover:underline">
              contact us
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ step, n }: { step: Step; n: number }) {
  const cls =
    step === "done"
      ? "bg-accent text-white border-accent"
      : step === "current"
        ? "bg-accent-50 text-accent-hover border-accent"
        : step === "failed"
          ? "bg-alert-50 text-alert border-alert"
          : "bg-sheet text-text-2 border-line-strong";
  return (
    <span className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold ${cls}`}>
      {step === "done" ? (
        <svg aria-hidden viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : step === "failed" ? (
        <span aria-hidden>!</span>
      ) : (
        <span aria-hidden>{n}</span>
      )}
      {step === "current" && <span aria-hidden className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-30 motion-reduce:hidden" />}
      <span className="sr-only">{step === "done" ? "Done" : step === "current" ? "In progress" : step === "failed" ? "Stopped" : "Not started"}</span>
    </span>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 p-4 rounded-xl bg-paper-subtle border border-line text-sm text-text-2 leading-relaxed">{children}</div>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
      <span>{children}</span>
    </li>
  );
}
