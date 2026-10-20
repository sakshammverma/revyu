export function InteractiveTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-hover ${className}`}
    >
      <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3l14 8-6 2-2 6z" />
      </svg>
      Interactive
    </span>
  );
}
