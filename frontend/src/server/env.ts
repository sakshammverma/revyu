/**
 * Server-side configuration. Mirrors backend/app/core/config.py: same variable
 * names, same rule that any non-local ENVIRONMENT refuses to run with default
 * secrets or missing provider keys. Read lazily so `next build` works without
 * secrets. Never import this from client code.
 */

export interface Env {
  environment: string;
  isLocal: boolean;
  databaseUrl: string;
  disableRateLimits: boolean;
  frontendBaseUrl: string;
  adminSessionSecret: string;
  emailProviderApiKey: string;
  emailFromAddress: string;
}

let cached: Env | undefined;

/** Accepts the Python-style `postgresql+psycopg://` too, so one URL works for both stacks. */
export function normalizeDatabaseUrl(raw: string): string {
  return raw.replace(/^postgres(ql)?(\+\w+)?:\/\//, "postgresql://");
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const environment = source.ENVIRONMENT ?? "local";
  const isLocal = environment === "local";
  const databaseUrl = normalizeDatabaseUrl(source.DATABASE_POOL_URL || source.DATABASE_URL || "");

  const env: Env = {
    environment,
    isLocal,
    databaseUrl,
    // Honoured only when ENVIRONMENT=local, so repeated e2e runs are not throttled.
    disableRateLimits: isLocal && source.DISABLE_RATE_LIMITS === "true",
    frontendBaseUrl: source.FRONTEND_BASE_URL ?? "http://localhost:3000",
    adminSessionSecret: source.ADMIN_SESSION_SECRET ?? "change-me",
    emailProviderApiKey: source.EMAIL_PROVIDER_API_KEY ?? "",
    emailFromAddress: source.EMAIL_FROM_ADDRESS ?? "noreply@revyu.in",
  };

  const problems: string[] = [];
  if (!databaseUrl) problems.push("DATABASE_URL is required");
  if (!isLocal) {
    if (env.adminSessionSecret === "" || env.adminSessionSecret === "change-me" || env.adminSessionSecret.length < 24) {
      problems.push("ADMIN_SESSION_SECRET must be a random value of 24+ characters");
    }
    for (const name of [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "GOOGLE_PLACES_API_KEY",
      "EMAIL_PROVIDER_API_KEY",
    ]) {
      if (!source[name]) problems.push(`${name} is required when ENVIRONMENT=${environment}`);
    }
  }
  if (problems.length) throw new Error("Unsafe configuration: " + problems.join("; "));
  return env;
}

export function getEnv(): Env {
  return (cached ??= loadEnv());
}
