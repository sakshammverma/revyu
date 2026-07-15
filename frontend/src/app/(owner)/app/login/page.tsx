"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, Field } from "@/components/ui";
import { DashboardApiError, getMyOutlet, requestOtp, verifyOtp } from "@/lib/dashboard/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 30;

// SRS-10.1: single email field -> code entry. No password.
export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Already signed in? Skip straight to the dashboard.
  useEffect(() => {
    getMyOutlet()
      .then(() => router.replace("/app"))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a valid email address, like name@business.com");
      return;
    }
    setBusy(true);
    setEmailError(null);
    try {
      await requestOtp(email.trim());
      setStep("code");
      setCode("");
      setCodeError(null);
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setEmailError(
        e instanceof DashboardApiError && e.code === "RATE_LIMITED"
          ? "Too many attempts. Please wait a few minutes and try again."
          : "We couldn't send the code. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setCodeError(null);
    try {
      await verifyOtp(email.trim(), code);
      router.push("/app");
    } catch (e) {
      const c = e instanceof DashboardApiError ? e.code : "";
      setCodeError(
        c === "OTP_ATTEMPTS_EXCEEDED"
          ? "Too many incorrect attempts. Request a new code."
          : c === "RATE_LIMITED"
            ? "Too many attempts. Please wait a few minutes."
            : "That code is incorrect or has expired. Check it or request a new one."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="v2-sheet border border-line max-w-sm w-full p-6 sm:p-8">
        <Link href="/" className="font-bold text-xl tracking-tight text-ink block mb-6 pb-5 border-b border-line">
          Revyu
        </Link>

        {step === "email" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
            noValidate
          >
            <div>
              <h1 className="font-display text-2xl text-ink">Owner login</h1>
              <p className="text-sm text-text-2 mt-1">We&rsquo;ll email you a one-time code. No password needed.</p>
            </div>
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              error={emailError}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={busy} full>
              Send code
            </Button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <div>
              <h1 className="font-display text-2xl text-ink">Check your email</h1>
              <p className="text-sm text-text-2 mt-1 leading-relaxed">
                We sent a 6-digit code and a login link to <strong className="text-ink">{email}</strong>.{" "}
                <button
                  type="button"
                  className="text-accent font-semibold underline underline-offset-2 cursor-pointer"
                  onClick={() => setStep("email")}
                >
                  Change email
                </button>
              </p>
            </div>
            <Field
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              error={codeError}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="font-mono tabular-nums text-lg tracking-[0.5em]"
            />
            <Button type="submit" loading={busy} disabled={code.length !== 6} full>
              Log in
            </Button>
            <div className="text-sm text-text-2 text-center">
              {cooldown > 0 ? (
                <span>Resend available in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  className="text-accent font-semibold cursor-pointer underline underline-offset-2"
                  onClick={sendCode}
                >
                  Resend code
                </button>
              )}
              <p className="mt-2 text-xs">Not there after a minute? Check your spam folder.</p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
