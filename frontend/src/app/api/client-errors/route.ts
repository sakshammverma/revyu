import { z } from "zod";

import { handler, parseJson, rateLimit } from "@/server/http";

const body = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).nullish(),
  path: z.string().max(200),
});

/**
 * Receives browser error reports (src/instrumentation-client.ts) and writes
 * them to the server log. Nothing is stored. Anonymous, so it is rate limited
 * and only ever logs bounded strings.
 */
export const POST = handler(async (request: Request) => {
  await rateLimit(request, "client_errors", 30, 3600);
  const report = await parseJson(request, body);
  console.error(
    JSON.stringify({
      kind: "client_error",
      path: report.path.split("?")[0],
      message: report.message,
      stack: report.stack ?? undefined,
      ua: (request.headers.get("user-agent") ?? "").slice(0, 200),
    }),
  );
  return new Response(null, { status: 204 });
});
