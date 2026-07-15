"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

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
  /** Re-read outlet state + billing (after paying, etc). */
  refresh: () => Promise<void>;
};

const OwnerCtx = createContext<Ctx | null>(null);

export function useOwner(): Ctx {
  const v = useContext(OwnerCtx);
  if (!v) throw new Error("useOwner must be used inside <OwnerProvider>");
  return v;
}

const PRE_LIVE = ["pending_payment", "pending_approval", "rejected"];

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
  const router = useRouter();
  const [outlet, setOutlet] = useState<MyOutlet | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await getMyOutlet();
        const bill = PRE_LIVE.includes(mine.state) ? null : await getBillingStatus().catch(() => null);
        if (cancelled) return;
        setOutlet(mine);
        setBilling(bill);
        setError(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DashboardApiError && e.status === 401) {
          router.replace("/app/login");
          return;
        }
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, version]);

  const refresh = useCallback(async () => {
    setVersion((v) => v + 1);
  }, []);

  if (error) return <>{failed(() => { setError(false); setVersion((v) => v + 1); })}</>;
  if (!outlet) return <>{loading}</>;
  if (PRE_LIVE.includes(outlet.state)) return <>{preLive(outlet)}</>;

  return <OwnerCtx.Provider value={{ outlet, billing, refresh }}>{children}</OwnerCtx.Provider>;
}
