import type { Metadata } from "next";

/** The public origin: explicit setting, else the Vercel production domain, else local dev. */
export const siteUrl =
  process.env.FRONTEND_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

/**
 * Per-page metadata with the pieces every public page needs: a canonical URL (so
 * ?country=, ?email= and ?ref= variants don't compete with the real page) and its own
 * Open Graph title and description (otherwise every shared link shows the home page's).
 */
export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Revyu", locale: "en_IN", title, description, url: path },
  };
}
