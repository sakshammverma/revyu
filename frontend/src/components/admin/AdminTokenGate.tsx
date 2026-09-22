"use client";

import { useEffect, useId, useState } from "react";

import { getAdminToken, setAdminToken } from "@/lib/admin/api";

// Shared gate so any admin page/component can require the bearer token
// independently, rather than depending on another component happening to
// render first (documents/04-ARCHITECTURE.md §3.3 — founder-only auth).
export function AdminTokenGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const tokenInputId = useId();

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  if (!token) {
    return (
      <div className="v2-sheet border border-[#e8ecec] p-6 sm:p-8 max-w-md mx-auto">
        <label
          htmlFor={tokenInputId}
          className="block text-sm font-semibold text-[#1a1e23] mb-2"
        >
          Admin Secret Token
        </label>
        <input
          id={tokenInputId}
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter token to continue"
          className="w-full rounded-lg border border-[#d5dcdc] bg-white px-3.5 py-3 text-base text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25 transition-colors"
        />
        <button
          className="btn-primary mt-4 w-full min-h-[44px]"
          onClick={() => {
            setAdminToken(tokenInput);
            setToken(tokenInput);
          }}
        >
          Continue →
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
