import { handler, HttpError, rateLimit } from "@/server/http";
import { placesSearch } from "@/server/services/signup";

export const GET = handler(async (request: Request) => {
  // Every search is a billable Places call.
  await rateLimit(request, "places_search", 30, 3600);
  const params = new URL(request.url).searchParams;
  const q = params.get("q");
  const near = params.get("near");
  if (q === null || q.length > 200 || (near !== null && near.length > 200)) throw new HttpError(422, "VALIDATION_ERROR");
  return Response.json(await placesSearch(q, near));
});
