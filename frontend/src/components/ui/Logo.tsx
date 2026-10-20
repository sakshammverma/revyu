// The Revyu brand mark (two crossed rounded bars around a centre ring) and wordmark.
// One source for the navbar, footer, portal, admin and standalone pages; the favicon
// in src/app/icon.svg draws the same paths, so keep them in sync.

export function LogoMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a4 4 0 0 0-4 4v12a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
      <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 0 0 0 8h12a4 4 0 0 0 4-4z" />
    </svg>
  );
}

/** Mark + "Revyu". Colour comes from the parent's text colour; `markClassName` sizes/tints the mark. */
export function Logo({
  className = "",
  markClassName = "w-5 h-5",
  label = "Revyu",
}: {
  className?: string;
  markClassName?: string;
  label?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-sans font-bold tracking-tight ${className}`}>
      <LogoMark className={`shrink-0 ${markClassName}`} />
      <span>{label}</span>
    </span>
  );
}
