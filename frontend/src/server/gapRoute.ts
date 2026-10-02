import { HttpError } from "@/server/http";
import { PlacesUnavailableError } from "@/server/services/places";

/** Places being down or unconfigured is a 503 with the reason, like the Python. */
export async function orPlaces503<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof PlacesUnavailableError) throw new HttpError(503, "PLACES_UNAVAILABLE", err.message);
    throw err;
  }
}
