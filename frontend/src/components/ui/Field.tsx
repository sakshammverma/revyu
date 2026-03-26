"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  suffix?: ReactNode;
};

/** Labelled input with hint + inline error wired up via aria-describedby. */
export function Field({ label, hint, error, suffix, className = "", ...rest }: Props) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
          className={`w-full min-h-[44px] rounded-[var(--r-control)] border bg-sheet px-3.5 text-base text-ink placeholder:text-text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 ${
            error ? "border-alert" : "border-line-strong"
          } ${suffix ? "pr-24" : ""} ${className}`}
        />
        {suffix && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
