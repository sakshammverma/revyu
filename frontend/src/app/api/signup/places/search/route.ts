import { handler, HttpError } from "@/server/http";
import { placesSearch } from "@/server/services/signup";

export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get("q");
  if (q === null) throw new HttpError(422, "VALIDATION_ERROR");
  return Response.json(await placesSearch(q, params.get("near")));
});
