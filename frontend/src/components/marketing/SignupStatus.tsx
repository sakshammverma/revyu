"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSignupStatus } from "@/lib/signup/api";

interface Props {
  signupId: string;
}

const POLL_INTERVAL_MS = 10_000;

export function SignupStatus({ signupId }: Props) {
  const [state, setState] = useState<string>("pending_approval");
  const [message, setMessage] = useState("We're verifying your business details.");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const status = await fetchSignupStatus(signupId);
        if (cancelled) return;
        setState(status.state);
        setMessage(status.message);
      } catch {
        // Keep showing last known status
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [signupId]);

  return (
    <div className="max-w-xl mx-auto v2-sheet border border-[#e8ecec] p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#e8ecec]">
        <span className="font-mono text-xs uppercase tracking-wider text-[#515a63]">
          Application #{signupId.slice(0, 8)}
        </span>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            state === "trial"
              ? "bg-[#f0f7ed] text-[#2f6b1a] border border-[#449127]/25"
              : state === "rejected"
              ? "bg-[#fdf2f4] text-[#c62445] border border-[#c62445]/20"
              : "bg-[#e7f5fd] text-[#2f68db] border border-[#397dff]/20"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              state === "trial"
                ? "bg-[#449127] animate-pulse"
                : state === "rejected"
                ? "bg-[#c62445]"
                : "bg-[#397dff] animate-pulse"
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

      <div className="mt-6">
        <h2 className="font-display text-2xl sm:text-[28px] leading-snug tracking-tight text-[#1a1e23]">{message}</h2>

        {state === "pending_payment" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f7fafa] border border-[#e8ecec] text-sm text-[#515a63] leading-relaxed">
            We haven&rsquo;t received your payment authorisation yet. Nothing has been charged.{" "}
            <Link href="/signup" className="font-semibold text-[#2f68db] hover:underline">
              Return to signup
            </Link>{" "}
            to try again — your details are kept.
          </div>
        )}

        {state === "pending_approval" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f7fafa] border border-[#e8ecec] text-sm text-[#515a63] leading-relaxed">
            This verification typically takes a few hours. We confirm your business details against the Google listing you picked so that customer reviews always land on your genuine profile.
          </div>
        )}

        {state === "trial" && (
          <div className="mt-4 p-4 rounded-xl bg-[#f0f7ed] border border-[#449127]/25 text-sm text-[#1a1e23] leading-relaxed">
            <p className="font-semibold text-[#2f6b1a]">Your outlet is active!</p>
            <p className="mt-1 text-[#515a63]">
              We&rsquo;ve emailed you. Log in with your email address to download your QR code and print files — receipt footer, handout card, counter standee and sticker.
            </p>
            <div className="mt-4">
              <Link
                href="/app"
                className="btn-primary min-h-[40px]"
              >
                Go to Owner Dashboard →
              </Link>
            </div>
          </div>
        )}

        {state === "rejected" && (
          <div className="mt-4 p-4 rounded-xl bg-[#fdf2f4] border border-[#c62445]/20 text-sm text-[#515a63] leading-relaxed">
            If you think this is a mistake, reply to our email or{" "}
            <Link href="/contact" className="font-semibold text-[#2f68db] hover:underline">
              contact us
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
