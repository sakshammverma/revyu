/**
 * Validation for owner-entered social/contact links (FR-90): https and tel
 * only, host must match the platform, never a redirect through our own domain.
 * Port of backend/app/services/links.py; keep the two in lock-step.
 */

export const LINK_KINDS = [
  "google_maps",
  "instagram",
  "facebook",
  "youtube",
  "whatsapp",
  "website",
  "phone",
  "email",
  "custom",
] as const;

const HOSTS: Record<string, readonly string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
  youtube: ["youtube.com", "youtu.be"],
  google_maps: ["google.com", "maps.app.goo.gl", "goo.gl", "g.page", "maps.google.com"],
};

const NAMES: Record<string, string> = {
  instagram: "an Instagram",
  facebook: "a Facebook",
  youtube: "a YouTube",
  google_maps: "a Google Maps",
};

export class LinkError extends Error {}

const removePrefix = (s: string, p: string) => (s.startsWith(p) ? s.slice(p.length) : s);

/**
 * Host as Python's urlparse(value).hostname sees it (lower-cased, userinfo and
 * port dropped). Deliberately NOT `new URL()`: that rejects/normalises inputs
 * the Python accepts verbatim, and the stored value must match FastAPI's.
 */
function hostnameOf(value: string): string {
  // urlsplit drops tab/CR/LF anywhere and leading C0/space characters.
  const cleaned = value.replace(/[\t\r\n]/g, "").replace(/^[\u0000-\u0020]+/, "");
  const rest = cleaned.startsWith("//") ? cleaned.slice(2) : cleaned.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  const hasAuthority = cleaned.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned);
  if (!hasAuthority) return "";
  const netloc = rest.split(/[/?#]/, 1)[0];
  const at = netloc.lastIndexOf("@");
  const hostinfo = at >= 0 ? netloc.slice(at + 1) : netloc;
  let host: string;
  if (hostinfo.startsWith("[") && hostinfo.includes("]")) host = hostinfo.slice(1, hostinfo.indexOf("]"));
  else host = hostinfo.split(":", 1)[0];
  return host.toLowerCase();
}

const hostMatches = (host: string, allowed: readonly string[]) =>
  allowed.some((h) => host === h || host.endsWith("." + h));

export function normalizeLink(kind: string, raw: string, opts: { ownHosts?: readonly string[] } = {}): string {
  const ownHosts = opts.ownHosts ?? [];
  let value = (raw ?? "").trim();
  if (!value) throw new LinkError("Link is empty");
  if (!(LINK_KINDS as readonly string[]).includes(kind)) throw new LinkError("Unknown link type");

  if (kind === "phone") {
    const digits = removePrefix(value, "tel:").replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 7) throw new LinkError("Enter a valid phone number");
    return `tel:${digits}`;
  }
  if (kind === "email") {
    const email = removePrefix(value, "mailto:");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new LinkError("Enter a valid email");
    return `mailto:${email}`;
  }
  if (kind === "whatsapp") {
    const digits = value.replace("https://wa.me/", "").replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) throw new LinkError("Enter the WhatsApp number with country code");
    return `https://wa.me/${digits}`;
  }

  // Bare handle shortcuts for the social platforms.
  if ((kind === "instagram" || kind === "facebook") && !/^https?:\/\//.test(value)) {
    if (!value.includes(".")) value = `https://${kind}.com/${value.replace(/^@+/, "")}`;
  }
  if (!/^https?:\/\//.test(value)) value = `https://${value}`;
  if (value.startsWith("http://")) value = "https://" + value.slice("http://".length);

  const host = removePrefix(hostnameOf(value), "www.");
  if (!host || !host.includes(".")) throw new LinkError("Enter a valid URL");
  if (hostMatches(host, ownHosts)) throw new LinkError("Links cannot point back to this site");
  const allowed = HOSTS[kind];
  if (allowed && !hostMatches(host, allowed)) {
    throw new LinkError(`That doesn't look like ${NAMES[kind] ?? "the right"} link`);
  }
  return value;
}
