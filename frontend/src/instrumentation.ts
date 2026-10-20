import type { Instrumentation } from "next";

/**
 * Server error reporting without a third-party account: one JSON line per
 * error that Next captures (render, route handler, server action), readable and
 * filterable in Vercel's logs (`"kind":"server_error"`). Route handlers wrapped
 * in handler() catch their own errors and log them there instead.
 *
 * Only the path is logged, never the query string (magic-link tokens travel in
 * it) or headers (cookies).
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  console.error(
    JSON.stringify({
      kind: "server_error",
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      message: error.message.slice(0, 500),
      digest,
      stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    }),
  );
};
