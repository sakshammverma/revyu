import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "link" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

// Maps onto the design-system button classes in globals.css:
// primary -> .btn-primary, secondary -> .btn-pill-dark, outline -> white/line.
export function Button({
  variant = "primary",
  href,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  if (variant === "link") {
    const cls = `font-semibold text-sm text-[#1a1e23] hover:text-[#397dff] transition-colors inline-flex items-center gap-1 ${className}`;
    return href ? (
      <Link href={href} className={cls}>
        {children}
      </Link>
    ) : (
      <button className={cls} {...rest}>
        {children}
      </button>
    );
  }

  let variantStyle = "";
  if (variant === "primary") {
    variantStyle = "btn-primary";
  } else if (variant === "secondary") {
    variantStyle = "btn-pill-dark justify-center";
  } else if (variant === "outline") {
    variantStyle =
      "inline-flex items-center justify-center gap-2 rounded-lg px-[18px] py-2 text-sm font-semibold bg-white hover:bg-[#f7fafa] text-[#1a1e23] border border-[#e8ecec] hover:border-[#397dff]/40 shadow-v2-rest transition-colors cursor-pointer";
  }

  const cls = `min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff] focus-visible:ring-offset-2 ${variantStyle} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
