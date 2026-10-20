"use client";

import { useCallback, useEffect, useId, useRef } from "react";

import { useToast } from "@/components/ui/Toast";

/* Small shared primitives for the owner/admin editors. Website look: white
   sheets, #e8ecec hairlines, #2f68db actions (AA contrast). */

export function Card({ title, hint, action, children, className = "" }: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`v2-sheet border border-[#e8ecec] p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h2 className="font-semibold text-[#1a1e23]">{title}</h2>}
            {hint && <p className="text-sm text-[#515a63] mt-0.5">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#d5dcdc] bg-white px-3.5 py-2.5 text-base text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25 disabled:bg-[#f2f7f7]";

export function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; describedBy?: string; className: string }) => React.ReactNode;
}) {
  const id = useId();
  const d = `${id}-d`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[#1a1e23]">{label}</label>
      {children({ id, describedBy: hint || error ? d : undefined, className: inputCls })}
      {(error || hint) && (
        <p id={d} className={`text-xs ${error ? "text-[#c62445]" : "text-[#59636a]"}`} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, ...rest }: {
  label: string;
  hint?: string;
  error?: string | null;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(p) => <input {...rest} id={p.id} aria-describedby={p.describedBy} className={p.className} />}
    </Field>
  );
}

export function TextArea({ label, hint, ...rest }: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint}>
      {(p) => <textarea rows={3} {...rest} id={p.id} aria-describedby={p.describedBy} className={p.className} />}
    </Field>
  );
}

export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff] focus-visible:ring-offset-2 disabled:opacity-40 ${
        checked ? "bg-[#2f68db]" : "bg-[#bfc8ca]"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-xl bg-[#e8ecec] w-full sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 sm:flex-none min-h-[40px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            value === o.value ? "bg-white text-[#1a1e23] shadow-sm" : "text-[#515a63]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Btn({ variant = "primary", busy, className = "", children, ...rest }: {
  variant?: "primary" | "light" | "danger";
  busy?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "min-h-[44px] px-5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff] focus-visible:ring-offset-2";
  const v =
    variant === "primary"
      ? "bg-[#2f68db] hover:bg-[#2757b8] text-white"
      : variant === "danger"
        ? "bg-white border border-[#c62445] text-[#c62445] hover:bg-[#fdf2f4]"
        : "bg-white border border-[#bfc8ca] text-[#1a1e23] hover:border-[#1a1e23]";
  return (
    <button {...rest} disabled={rest.disabled || busy} aria-busy={busy || undefined} className={`${base} ${v} ${className}`}>
      {busy && <span aria-hidden className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {children}
    </button>
  );
}

export function Sheet({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass an inline onClose; reading it through a ref keeps the effect
  // from re-running (and stealing focus from the input) on every keystroke.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  // Typing anywhere inside makes the sheet "dirty"; closing it then asks first, so a
  // stray backdrop tap or Escape can't throw away what was typed.
  const dirty = useRef(false);
  useEffect(() => {
    if (open) dirty.current = false;
  }, [open]);
  const requestClose = useCallback(() => {
    if (dirty.current && !window.confirm("Discard your changes?")) return;
    closeRef.current();
  }, []);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return requestClose();
      if (e.key !== "Tab" || !ref.current) return;
      // Keep Tab inside the dialog.
      const items = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    // The page behind must not scroll while the sheet is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, requestClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={requestClose} />
      <div ref={ref} tabIndex={-1} onInput={() => { dirty.current = true; }} className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto outline-none">
        <div className="sticky top-0 bg-white border-b border-[#e8ecec] px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-[#1a1e23]">{title}</h2>
          <button type="button" onClick={requestClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-lg text-[#515a63] hover:bg-[#f2f7f7]">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#bfc8ca] p-6 text-center">
      <p className="font-semibold text-[#1a1e23]">{title}</p>
      {body && <p className="text-sm text-[#515a63] mt-1">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* Toasts: kept as an adapter so the editors keep their (text, kind, undo) call shape, but there
   is one toast system (ui/Toast), so two stacks can never overlap. Needs a <ToastProvider> above. */
export function useToasts() {
  const { toast } = useToast();
  const push = useCallback(
    (text: string, kind: "ok" | "error" = "ok", undo?: () => void) =>
      toast(text, { tone: kind === "error" ? "error" : "success", onAction: undo }),
    [toast],
  );
  return { push, node: null as React.ReactNode };
}
