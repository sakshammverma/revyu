"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSignupStatus, SignupNotFoundError } from "@/lib/signup/api";

interface Props {
  signupId: string;
}

const POLL_INTERVAL_MS = 10_000;
/** States that can still change on their own (payment or founder approval pending). */
const WAITING = new Set(["draft", "pending_payment", "pending_approval"]);
const MAX_FAILURES = 3;

export function SignupStatus({ signupId }: Props) {
  const [state, setState] = useState<string>("pending_approval");
  const [message, setMessage] = useState("We're verifying your business details.");
  const [loadError, setLoadError] = useState<"not_found" | "network" | null>(null);

  // Poll while the outcome is pending; stop once it's decided, on a 404, or
  // after repeated failures, and skip ticks while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (document.hidden) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      try {
        const status = await fetchSignupStatus(signupId);
        if (cancelled) return;
        failures = 0;
        setLoadError(null);
        setState(status.state);
        setMessage(status.message);
        if (!WAITING.has(status.state)) return;
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SignupNotFoundError) {
          setLoadError("not_found");
          return;
        }
        if (++failures >= MAX_FAILURES) setLoadError("network");
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signupId]);

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

  return (
    <div className="max-w-xl mx-auto v2-sheet border border-line p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-line">
        <span className="font-mono text-xs uppercase tracking-wider text-text-2">
          Application #{signupId.slice(0, 8)}
        </span>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            state === "trial"
              ? "bg-[#f0f7ed] text-success-strong border border-[#449127]/25"
              : state === "rejected"
              ? "bg-alert-50 text-alert border border-alert/20"
              : "bg-accent-50 text-accent-hover border border-accent/20"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              state === "trial"
                ? "bg-success animate-pulse"
                : state === "rejected"
                ? "bg-[#c62445]"
                : "bg-accent animate-pulse"
            }`}
          />
          <span>
            {state === "trial"
              ? "Verified & Live"
              : state === "rejected"
              ? "Not approved"
              : state === "pending_payment"
              ? "Awaiting payment"
              : "Verifying"}
          </span>
        </div>
      </div>

      {loadError === "network" && (
        <p role="status" className="mt-4 text-sm text-alert">
          We&rsquo;re having trouble checking for updates. This page will keep trying; you can also refresh it.
        </p>
      )}

      <div className="mt-6">
        <h2 className="font-display text-2xl sm:text-[28px] leading-snug tracking-tight text-ink">{message}</h2>

        {state === "pending_payment" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f7fafa] border border-line text-sm text-text-2 leading-relaxed">
            We haven&rsquo;t received your payment authorisation yet. Nothing has been charged.{" "}
            <Link href="/signup" className="font-semibold text-accent-hover hover:underline">
              Return to signup
            </Link>{" "}
            to try again — your details are kept.
          </div>
        )}

        {state === "pending_approval" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f7fafa] border border-line text-sm text-text-2 leading-relaxed">
            This verification typically takes a few hours. We confirm your business details against the Google listing you picked so that customer reviews always land on your genuine profile.
          </div>
        )}

        {state === "trial" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f0f7ed] border border-[#449127]/25 text-sm text-ink leading-relaxed">
            <p className="font-semibold text-success-strong">Your outlet is active!</p>
            <p className="mt-1 text-text-2">
              We&rsquo;ve emailed you. Log in with your email address to download your QR code and print files — receipt footer, handout card, counter standee and sticker.
            </p>
            <div className="mt-4">
              {/* A full load: inside the owner portal this screen is already at /app. */}
              <a href="/app" className="btn-primary min-h-[44px]">
                Go to Owner Dashboard →
              </a>
            </div>
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
