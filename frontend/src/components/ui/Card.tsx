import type { ReactNode } from "react";

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`v2-sheet border border-line p-4 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-line">
          <div className="min-w-0">
            {title && <h2 className="font-display text-xl text-ink">{title}</h2>}
            {description && <p className="text-sm text-text-2 mt-0.5">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 sm:p-5 rounded-xl border min-w-0 ${
        highlight ? "bg-accent-50 border-accent/25" : "bg-paper-subtle/50 border-line"
      }`}
    >
      <p className="text-[11px] sm:text-xs sm:uppercase sm:tracking-wider text-text-2 font-semibold leading-tight">{label}</p>
      <p className="font-display text-2xl sm:text-4xl leading-none tabular-nums mt-2 text-ink">{value}</p>
      {note && <p className="text-[11px] sm:text-xs text-text-2 mt-1.5 leading-snug">{note}</p>}
    </div>
  );
}
