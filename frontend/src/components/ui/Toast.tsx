"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; tone: Tone; message: string; actionLabel?: string; onAction?: () => void };

type Api = {
  toast: (message: string, opts?: { tone?: Tone; actionLabel?: string; onAction?: () => void }) => void;
};

const Ctx = createContext<Api>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

const TONE: Record<Tone, string> = {
  success: "bg-ink text-white",
  error: "bg-alert text-white",
  info: "bg-ink text-white",
};

// A toast with an Undo stays longer: 6s was too short for keyboard and screen-reader users (WCAG 2.2.1).
const SHOW_MS = 4000;
const SHOW_WITH_ACTION_MS = 10000;
const AFTER_LEAVE_MS = 2000;

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  // Hovering or focusing a toast holds it open; it leaves a moment after the pointer or focus does.
  const [held, setHeld] = useState(false);
  const [left, setLeft] = useState(false);
  useEffect(() => {
    if (held) return;
    const ms = left ? AFTER_LEAVE_MS : item.onAction ? SHOW_WITH_ACTION_MS : SHOW_MS;
    const t = setTimeout(() => onDismiss(item.id), ms);
    return () => clearTimeout(t);
  }, [held, left, item.id, item.onAction, onDismiss]);

  return (
    <div
      // Errors are announced assertively; everything else politely through the container.
      role={item.tone === "error" ? "alert" : undefined}
      style={{ animation: "uiToastIn .2s ease-out" }}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => {
        setHeld(false);
        setLeft(true);
      }}
      onFocus={() => setHeld(true)}
      onBlur={() => {
        setHeld(false);
        setLeft(true);
      }}
      className={`flex items-center justify-between gap-3 rounded-xl pl-4 pr-2 py-2 text-sm shadow-v2-elevated ${TONE[item.tone]}`}
    >
      <span className="py-1">{item.message}</span>
      <span className="flex items-center shrink-0">
        {item.onAction && (
          <button
            onClick={() => {
              item.onAction?.();
              onDismiss(item.id);
            }}
            className="font-semibold underline underline-offset-2 cursor-pointer min-h-[44px] px-2"
          >
            {item.actionLabel ?? "Undo"}
          </button>
        )}
        <button
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss"
          className="cursor-pointer min-h-[44px] min-w-[44px] text-white/80 hover:text-white"
        >
          <span aria-hidden>✕</span>
        </button>
      </span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback<Api["toast"]>((message, opts) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p.slice(-2), { id, tone: opts?.tone ?? "success", message, ...opts }]);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* aria-live region: announces without stealing focus */}
      <div
        aria-live="polite"
        role="status"
        className="fixed z-[100] bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,420px)]"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
