import type { MetadataRoute } from "next";

const siteUrl =
  process.env.FRONTEND_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const PAGES = ["", "/how-it-works", "/pricing", "/compliance", "/gap-report", "/signup", "/contact", "/privacy", "/terms", "/refund-policy", "/credits"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
