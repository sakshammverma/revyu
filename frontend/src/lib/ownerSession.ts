/**
 * The owner session expired or was revoked mid-visit: send them to login and
 * bring them back to this page afterwards. Callers opt out where a 401 is the
 * expected answer (the login page's "already signed in?" probe).
 */
export function redirectToOwnerLogin(): void {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/app/login")) return;
  const next = window.location.pathname + window.location.search;
  // A full load on purpose: it drops every piece of stale owner state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/app/login?next=${encodeURIComponent(next)}`);
}

/** Only same-site app paths are honoured as a post-login destination (no open redirect). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}
