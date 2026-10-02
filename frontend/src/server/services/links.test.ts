import { describe, expect, it } from "vitest";

import corpus from "./fixtures/links-corpus.json";
import { LinkError, normalizeLink } from "./links";

const own = ["revyu.in"];
const err = (kind: string, raw: string, ownHosts: string[] = []) => {
  try {
    normalizeLink(kind, raw, { ownHosts });
  } catch (e) {
    if (e instanceof LinkError) return e.message;
    throw e;
  }
  throw new Error("expected a LinkError");
};

describe("normalizeLink (port of test_link_normalisation_and_validation)", () => {
  it("normalises the happy paths", () => {
    expect(normalizeLink("whatsapp", "+91 98765 43210")).toBe("https://wa.me/919876543210");
    expect(normalizeLink("instagram", "@mycafe")).toBe("https://instagram.com/mycafe");
    expect(normalizeLink("phone", "tel:+91 98765-43210")).toBe("tel:+919876543210");
    expect(normalizeLink("website", "http://example.com")).toMatch(/^https:\/\//);
    expect(normalizeLink("email", "mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeLink("facebook", "https://www.facebook.com/a")).toBe("https://www.facebook.com/a");
  });

  it("rejects wrong hosts, unsafe schemes and our own domain", () => {
    expect(err("instagram", "https://evil.com/x")).toMatch(/Instagram/);
    expect(err("website", "javascript:alert(1)")).toBe("Enter a valid URL");
    expect(err("website", "https://revyu.in/r/x", own)).toBe("Links cannot point back to this site");
    expect(err("website", "https://sub.revyu.in/r/x", own)).toBe("Links cannot point back to this site");
    expect(normalizeLink("website", "https://notrevyu.in", { ownHosts: own })).toBe("https://notrevyu.in");
  });

  it("is not fooled by userinfo tricks", () => {
    expect(err("instagram", "https://instagram.com@evil.com/x")).toMatch(/Instagram/);
    expect(normalizeLink("instagram", "https://evil.com@instagram.com/x")).toBe("https://evil.com@instagram.com/x");
  });

  it("validates phone, email and whatsapp lengths", () => {
    expect(err("phone", "123")).toBe("Enter a valid phone number");
    expect(err("email", "a@b")).toBe("Enter a valid email");
    expect(err("whatsapp", "12345")).toBe("Enter the WhatsApp number with country code");
    expect(err("custom", "")).toBe("Link is empty");
    expect(err("nope", "x")).toBe("Unknown link type");
  });

  // 459 (kind, input) pairs recorded from the Python normalize_link: the two
  // implementations must agree on the value or on the exact error message.
  it("agrees with the Python implementation on the recorded corpus", () => {
    const mismatches = (corpus as { kind: string; in: string; r: { ok?: string; err?: string } }[]).filter((c) => {
      try {
        return normalizeLink(c.kind, c.in, { ownHosts: own }) !== c.r.ok;
      } catch (e) {
        return !(e instanceof LinkError) || e.message !== c.r.err;
      }
    });
    expect(mismatches).toEqual([]);
  });
});
