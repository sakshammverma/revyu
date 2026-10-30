"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Logo } from "@/components/ui";
import { safeNextPath } from "@/lib/ownerSession";

// The token is single-use, so it is sent once per page load however many times
// the effect runs (StrictMode mounts twice in dev); every mount awaits the same answer.
// "rejected" = the server checked the link and refused it (used or expired); "error" = it
// never got a clean answer (server error or offline), so the link may still be good.
type Outcome = "ok" | "rejected" | "error";
const attempts = new Map<string, Promise<Outcome>>();
function redeem(token: string): Promise<Outcome> {
  let p = attempts.get(token);
  if (!p) {
    p = fetch(`/api/app/auth/magic?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then((res): Outcome => (res.ok ? "ok" : res.status < 500 ? "rejected" : "error"))
      .catch((): Outcome => "error");
    attempts.set(token, p);
    // A failed attempt shouldn't stick: "Try again" sends the token once more.
    p.then((o) => o === "error" && attempts.delete(token));
  }
  return p;
}

function MagicLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const next = safeNextPath(params.get("next"));
  const [failed, setFailed] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    redeem(token).then((outcome) => {
      if (cancelled) return;
      // replace, so Back doesn't land on a used link.
      if (outcome === "ok") router.replace(next);
      else setFailed(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [token, router, next, attempt]);

  if (token && !failed) {
    return (
      <p role="status" className="text-base text-ink">
        Logging you in…
      </p>
    );
  }
  if (token && failed === "error") {
    return (
      <div role="alert">
        <h1 className="font-display text-xl text-ink">We couldn&rsquo;t log you in just now</h1>
        <p className="text-sm text-text-2 mt-1">Your link wasn&rsquo;t used up. Try again in a moment, or get a new code.</p>
        <Button
          full
          className="mt-4"
          onClick={() => {
            setFailed(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
        <Button href="/app/login" variant="secondary" full className="mt-2">
          Get a new login code
        </Button>
      </div>
    );
  }
  return (
    <div role="alert">
      <h1 className="font-display text-xl text-ink">
        {token ? "This link has expired or was already used" : "This login link is incomplete"}
      </h1>
      <p className="text-sm text-text-2 mt-1">
        {token ? "Login links work once. Get a fresh code and you’re back in." : "Open the link from your email again, or get a new code."}
      </p>
      <Button href="/app/login" full className="mt-4">
        Get a new login code
      </Button>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="v2-sheet border border-line max-w-sm w-full px-6 py-8 text-center">
        <div className="flex justify-center text-ink mb-5">
          <Logo className="text-xl" markClassName="w-6 h-6" />
        </div>
        <Suspense fallback={<p role="status" className="text-base text-ink">Logging you in…</p>}>
          <MagicLoginInner />
        </Suspense>
      </div>
    </main>
  );
}
