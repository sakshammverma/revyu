import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-v2-btn",
  secondary: "bg-sheet text-ink border border-line-strong hover:bg-paper-subtle",
  ghost: "bg-transparent text-text-2 hover:bg-paper-subtle hover:text-ink",
  danger: "bg-alert text-white hover:opacity-90",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-4 min-h-[44px] text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
  href?: string;
  children: ReactNode;
};

export function Button({ variant = "primary", loading, full, href, className = "", children, disabled, ...rest }: Props) {
  const cls = `${BASE} ${VARIANTS[variant]} ${full ? "w-full" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cls}>
      {loading && (
        <span aria-hidden className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}
