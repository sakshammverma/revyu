"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = ""; // same-origin route handlers

function MagicLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing login token.");
      return;
    }
    fetch(`${API_BASE}/api/app/auth/magic?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        router.push("/app");
      })
      .catch(() => setError("This link has expired or already been used."));
  }, [params, router]);

  return <p className="text-base text-[#1a1e23]">{error ?? "Logging you in…"}</p>;
}

export default function MagicLoginPage() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center px-4 py-10 bg-[#f2f7f7]">
      <div className="v2-sheet border border-[#e8ecec] max-w-sm w-full px-6 py-8 text-center">
        <Suspense fallback={<p className="text-base text-[#1a1e23]">Logging you in…</p>}>
          <MagicLoginInner />
        </Suspense>
      </div>
    </main>
  );
}
