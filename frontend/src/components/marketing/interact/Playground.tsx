"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const DEMOS = [
  { id: "rate", label: "Rate a visit", anchor: "build" },
  { id: "draft", label: "Build a review draft", anchor: "mechanism" },
  { id: "kit", label: "Browse the print kit", anchor: "kit" },
  { id: "specialty", label: "Pick your business type", anchor: "specialties" },
  { id: "rank", label: "Check your Google gap", anchor: "gap" },
  { id: "roi", label: "Slide your average bill", anchor: "calculator" },
] as const;
export type DemoId = (typeof DEMOS)[number]["id"];

const KEY = "revyu.playground";

type Ctx = { tried: ReadonlySet<DemoId>; markTried: (id: DemoId) => void };
const PlaygroundCtx = createContext<Ctx>({ tried: new Set(), markTried: () => {} });

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [tried, setTried] = useState<ReadonlySet<DemoId>>(new Set());

  // Restore after hydration (server and first client render both start empty).
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as DemoId[];
        if (saved.length) setTried((prev) => new Set([...prev, ...saved]));
      } catch {}
    });
  }, []);

  const markTried = useCallback((id: DemoId) => {
    setTried((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(() => ({ tried, markTried }), [tried, markTried]);
  return <PlaygroundCtx.Provider value={value}>{children}</PlaygroundCtx.Provider>;
}

export function usePlayground(id?: DemoId) {
  const { tried, markTried } = useContext(PlaygroundCtx);
  return {
    tried: id ? tried.has(id) : false,
    markTried: () => {
      if (id) markTried(id);
    },
    all: tried,
  };
}
