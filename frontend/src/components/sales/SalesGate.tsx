"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { SalesApiError, clearPin, getSession, readPin, storePin } from "@/lib/marketing/salesApi";
import type { SalesRole } from "@/lib/marketing/salesTypes";

type Phase = { kind: "checking" } | { kind: "locked" } | { kind: "open"; role: SalesRole };

interface SalesSessionView {
  role: SalesRole;
  /** Forgets the PIN on this device and shows the gate again. */
  signOut: () => void;
}

const SessionContext = createContext<SalesSessionView | null>(null);

/** The unlocked session, for anything inside <SalesGate>. */
export function useSalesSession(): SalesSessionView {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSalesSession must be used inside <SalesGate>");
  return ctx;
}

function messageFor(e: unknown): string {
  if (e instanceof SalesApiError) {
    if (e.status === 401) return "That PIN didn't work.";
    if (e.status === 429) return "Too many tries. Try again in an hour.";
    if (e.status === 0) return "No connection. Check the internet and try again.";
  }
  return "Couldn't check the PIN. Try again.";
}

/**
 * The /marketing lock. The admin secret or the shared sales PIN is checked with the server
 * at once, then sent with every demo call. The sales PIN is kept on this device
 * (localStorage); the admin secret only for this tab (sessionStorage).
 */
export function SalesGate({ children }: { children: (role: SalesRole, signOut: () => void) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const stored = readPin();
      if (!stored) {
        if (live) setPhase({ kind: "locked" });
        return;
      }
      try {
        const s = await getSession();
        // Re-store under the role's rule, which also moves an admin secret an older build
        // left in localStorage into this tab's storage.
        storePin(stored, s.role);
        if (live) setPhase({ kind: "open", role: s.role });
      } catch (e) {
        if (!live) return;
        setError(e instanceof SalesApiError && e.status === 401 ? null : messageFor(e));
        setPhase({ kind: "locked" });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const signOut = useCallback(() => {
    clearPin();
    setPin("");
    setError(null);
    setPhase({ kind: "locked" });
  }, []);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    const typed = pin.trim();
    if (!typed) {
      setError("Enter the sales PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await getSession(typed);
      storePin(typed, s.role);
      setPin("");
      setPhase({ kind: "open", role: s.role });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (phase.kind === "open") {
    return (
      <SessionContext.Provider value={{ role: phase.role, signOut }}>{children(phase.role, signOut)}</SessionContext.Provider>
    );
  }

  return (
    <main className="marketing-root min-h-[100dvh] bg-bg text-ink flex items-center justify-center px-5 py-10">
      {phase.kind === "checking" ? (
        <div role="status" className="flex flex-col items-center gap-3 text-text-2">
          <span aria-hidden className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-sm">Checking this device…</span>
        </div>
      ) : (
        <form
          onSubmit={unlock}
          noValidate
          className="flow-step w-full max-w-sm rounded-[var(--r-card)] border border-line bg-sheet p-6 sm:p-8 shadow-v2-btn"
        >
          <Logo className="text-ink text-lg" markClassName="w-6 h-6" />
          <h1 className="font-display text-3xl text-ink mt-6">Sales demo</h1>
          <p className="text-sm text-text-2 mt-2">For the Revyu team. Enter your PIN to show a shop its demo.</p>
          <div className="mt-6">
            <Field
              label="Sales PIN"
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              error={error}
              autoFocus
            />
          </div>
          <Button type="submit" full loading={busy} className="mt-5">
            Unlock
          </Button>
        </form>
      )}
    </main>
  );
}
