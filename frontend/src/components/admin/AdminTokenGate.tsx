"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { getAdminToken, setAdminToken, subscribeAdminToken } from "@/lib/admin/api";

// Shared gate so any admin page/component can require the bearer token
// independently, rather than depending on another component happening to
// render first (documents/04-ARCHITECTURE.md §3.3 — founder-only auth).
export function AdminTokenGate({ children }: { children: React.ReactNode }) {
  // Server snapshot is null, so the gate renders until the client reads storage.
  // A 401 anywhere clears the token and this re-renders back to the prompt.
  const token = useSyncExternalStore(subscribeAdminToken, getAdminToken, () => null);
  const [tokenInput, setTokenInput] = useState("");
  const tokenInputId = useId();

  if (!token) {
    return (
      <form
        className="v2-sheet border border-line p-6 sm:p-8 max-w-md mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (tokenInput.trim()) setAdminToken(tokenInput.trim());
        }}
      >
        <label
          htmlFor={tokenInputId}
          className="block text-sm font-semibold text-ink mb-2"
        >
          Admin Secret Token
        </label>
        <input
          id={tokenInputId}
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter token to continue"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
        />
        <button type="submit" className="btn-primary mt-4 w-full min-h-[44px]">
          Continue →
        </button>
      </form>
    );
  }

  return <>{children}</>;
}
