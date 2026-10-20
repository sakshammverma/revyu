import type { MetadataRoute } from "next";

const siteUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

// Owner, admin, staff and per-outlet customer pages are private or per-business;
// only the marketing site is meant for search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/admin", "/staff", "/r/", "/api/", "/signup/status", "/uploads/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
