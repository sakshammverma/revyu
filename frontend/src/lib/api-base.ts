/**
 * Base URL for API calls. The API is Next.js route handlers in this same app
 * (src/app/api/**), so every call is same-origin: first-party session cookie,
 * no CORS, and sendBeacon works with a JSON body. Kept as a constant so call
 * sites read the same as before the Python backend was retired.
 */
export const API_BASE = "";
