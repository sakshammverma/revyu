"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Field } from "@/components/ui";
import { DashboardApiError, getMyOutlet, requestOtp, verifyOtp } from "@/lib/dashboard/api";
import { safeNextPath } from "@/lib/ownerSession";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 30;

// SRS-10.1: single email field -> code entry. No password.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // Already signed in? Skip straight to the dashboard.
  useEffect(() => {
    getMyOutlet({ redirectOn401: false })
      .then(() => router.replace(next))
      .catch(() => {});
  }, [router, next]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(isResend = false) {
    if (busy) return;
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
      setResent(isResend);
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

  async function verify(entered = code) {
    setBusy(true);
    setCodeError(null);
    try {
      await verifyOtp(email.trim(), entered);
      router.replace(next);
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
        <Link href="/" className="text-ink flex mb-6 pb-5 border-b border-line">
          <Logo className="text-xl" markClassName="w-6 h-6" />
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
            <p className="text-xs text-text-2 text-center">
              New to Revyu?{" "}
              <Link href="/signup" className="text-accent font-semibold underline underline-offset-2">
                Start your free trial
              </Link>
            </p>
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
                If this email has an account, we sent a 6-digit code and a login link to <strong className="text-ink">{email}</strong>.{" "}
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
              value={code}
              error={codeError}
              onChange={(e) => {
                // No maxLength: a pasted "123 456" must survive until the non-digits are stripped.
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                if (digits.length === 6 && !busy) verify(digits);
              }}
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
                  disabled={busy}
                  onClick={() => sendCode(true)}
                >
                  {busy ? "Sending…" : "Resend code"}
                </button>
              )}
              {resent && cooldown > 0 && (
                <p role="status" className="mt-1 text-xs text-success">
                  A new code is on its way.
                </p>
              )}
              <p className="mt-2 text-xs">Not there after a minute? Check your spam folder.</p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
