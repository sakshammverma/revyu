/** First focusable element on a marketing page, ahead of the promo bar and header. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-white focus:text-ink focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-v2-elevated"
    >
      Skip to content
    </a>
  );
}
