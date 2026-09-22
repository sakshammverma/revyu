"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback<Api["toast"]>(
    (message, opts) => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-2), { id, tone: opts?.tone ?? "success", message, ...opts }]);
      setTimeout(() => dismiss(id), opts?.onAction ? 6000 : 3500);
    },
    [dismiss]
  );

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
          <div
            key={t.id}
            style={{ animation: "uiToastIn .2s ease-out" }}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-v2-elevated ${TONE[t.tone]}`}
          >
            <span>{t.message}</span>
            {t.onAction && (
              <button
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="font-semibold underline underline-offset-2 cursor-pointer shrink-0"
              >
                {t.actionLabel ?? "Undo"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
