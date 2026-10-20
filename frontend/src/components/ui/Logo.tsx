// The Revyu brand mark (blue tile, two crossed rounded bars around a centre ring in white) and wordmark.
// One source for the navbar, footer, portal, admin and standalone pages; the favicon
// in src/app/icon.svg draws the same paths, so keep them in sync.

export function LogoMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <g transform="translate(4 4) scale(0.667)" fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2a4 4 0 0 0-4 4v12a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
        <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 0 0 0 8h12a4 4 0 0 0 4-4z" />
      </g>
    </svg>
  );
}

/** Mark + "Revyu". Colour comes from the parent's text colour; `markClassName` sizes the mark. */
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
