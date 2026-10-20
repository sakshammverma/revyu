/**
 * Browser error reporting: uncaught errors and unhandled promise rejections are
 * beaconed to /api/client-errors, which logs them as `"kind":"client_error"`
 * lines in Vercel's logs. A few per page load at most, path only (no query).
 * Never throws: monitoring must not break the page it is watching.
 */
const MAX_REPORTS = 5;
let sent = 0;

function report(message: string, stack: string | undefined) {
  try {
    if (sent >= MAX_REPORTS || !message) return;
    sent += 1;
    const body = JSON.stringify({
      message: message.slice(0, 500),
      stack: stack?.slice(0, 2000),
      path: window.location.pathname.slice(0, 200),
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-errors", blob)) {
      fetch("/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
        () => {},
      );
    }
  } catch {
    // ignore
  }
}

try {
  window.addEventListener("error", (event) => {
    // Resource load failures (img/script) have no error object; skip them.
    if (event.error instanceof Error) report(event.error.message, event.error.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const r: unknown = event.reason;
    if (r instanceof Error) report(r.message, r.stack);
    else if (typeof r === "string") report(r, undefined);
  });
} catch {
  // ignore
}
