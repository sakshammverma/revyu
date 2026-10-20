"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// The token is single-use, so it is sent once per page load however many times
// the effect runs (StrictMode mounts twice in dev); every mount awaits the same answer.
const attempts = new Map<string, Promise<boolean>>();
function redeem(token: string): Promise<boolean> {
  let p = attempts.get(token);
  if (!p) {
    p = fetch(`/api/app/auth/magic?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false);
    attempts.set(token, p);
  }
  return p;
}

function MagicLoginInner() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    redeem(token).then((ok) => {
      if (cancelled) return;
      // replace, so Back doesn't land on a used link.
      if (ok) router.replace("/app");
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (token && !failed) return <p className="text-base text-ink">Logging you in…</p>;
  return (
    <div role="alert">
      <p className="text-base text-ink">
        {token ? "This link has expired or has already been used." : "This login link is incomplete."}
      </p>
      <Link href="/app/login" className="btn-primary mt-4 inline-flex min-h-[44px] items-center justify-center w-full">
        Get a new login code
      </Link>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="v2-sheet border border-line max-w-sm w-full px-6 py-8 text-center">
        <Suspense fallback={<p className="text-base text-ink">Logging you in…</p>}>
          <MagicLoginInner />
        </Suspense>
      </div>
    </main>
  );
}
