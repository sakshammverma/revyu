/**
 * Logo auto-fetch with a generated wordmark fallback (SRS-11.13,
 * documents/13-MULTI-TENANT.md section 4.3). Port of backend/app/services/logo.py
 * (Pillow -> sharp with an SVG text overlay). Nothing calls this yet in either
 * stack; it is ported so the capability is not lost.
 *
 * The wordmark text is rendered by librsvg using the host's sans-serif font,
 * so glyph shapes differ slightly from Pillow's default font.
 */
import sharp from "sharp";

export const WORDMARK_SIZE = { width: 600, height: 200 } as const;
const PAPER = "#F5F5EF"; // the design system's paper base
const INK = "#282828";

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** A clean type-set business name on paper base: the documented v1 fallback. */
export async function generateWordmark(businessName: string): Promise<Buffer> {
  const { width, height } = WORDMARK_SIZE;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${PAPER}"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" ` +
    `font-size="48" fill="${INK}">${escapeXml(businessName.toUpperCase())}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Try the website's og:image, else the generated wordmark. Google Business
 * Profile photos are a documented gap (separate billable Places endpoint).
 */
export async function fetchLogoOrFallback(businessName: string, websiteUrl?: string | null): Promise<Buffer> {
  if (websiteUrl) {
    const og = await tryFetchOgImage(websiteUrl);
    if (og) return og;
  }
  return generateWordmark(businessName);
}

async function tryFetchOgImage(websiteUrl: string): Promise<Buffer | null> {
  try {
    const page = await fetch(websiteUrl, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (!page.ok) return null;
    const match = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(await page.text());
    if (!match) return null;
    const img = await fetch(new URL(match[1], page.url), { signal: AbortSignal.timeout(8000), redirect: "follow" });
    return img.ok ? Buffer.from(await img.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
