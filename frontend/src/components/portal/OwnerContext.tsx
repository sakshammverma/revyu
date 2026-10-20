"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  DashboardApiError,
  getBillingStatus,
  getMyOutlet,
  type BillingStatus,
  type MyOutlet,
} from "@/lib/dashboard/api";

type Ctx = {
  outlet: MyOutlet;
  billing: BillingStatus | null;
  /** Re-read outlet state + billing (after paying, etc). Resolves once the new state is in. */
  refresh: () => Promise<void>;
};

const OwnerCtx = createContext<Ctx | null>(null);

export function useOwner(): Ctx {
  const v = useContext(OwnerCtx);
  if (!v) throw new Error("useOwner must be used inside <OwnerProvider>");
  return v;
}

// Not live yet: no billing, no dashboard data, no print files (see outletState.ts).
const PRE_LIVE = ["draft", "pending_payment", "pending_approval", "rejected"];

// Coming back to a tab that has sat in the background: trial countdown and lock state may be stale.
const STALE_AFTER_MS = 5 * 60 * 1000;

export function OwnerProvider({
  children,
  preLive,
  loading,
  failed,
}: {
  children: ReactNode;
  preLive: (outlet: MyOutlet) => ReactNode;
  loading: ReactNode;
  failed: (retry: () => void) => ReactNode;
}) {
  const [outlet, setOutlet] = useState<MyOutlet | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    try {
      // Both at once: billing is only used when the outlet is live, and a failed billing
      // read must not block the dashboard.
      const [mine, bill] = await Promise.all([getMyOutlet(), getBillingStatus().catch(() => null)]);
      setOutlet(mine);
      setBilling(PRE_LIVE.includes(mine.state) ? null : bill);
      setError(false);
      setLoadedAt(Date.now());
    } catch (e) {
      // A 401 is already on its way to the login page (redirectToOwnerLogin in the API client).
      if (e instanceof DashboardApiError && e.status === 401) return;
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > STALE_AFTER_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, loadedAt]);

  const refresh = load;

  if (error) {
    return (
      <>
        {failed(() => {
          setError(false);
          load();
        })}
      </>
    );
  }
  if (!outlet) return <>{loading}</>;
  if (PRE_LIVE.includes(outlet.state)) return <>{preLive(outlet)}</>;

  return <OwnerCtx.Provider value={{ outlet, billing, refresh }}>{children}</OwnerCtx.Provider>;
}
