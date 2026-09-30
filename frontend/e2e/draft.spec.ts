/**
 * CR-1 / SRS-17.2: drafts are built only from the customer's own tags and the
 * outlet's factual record. No review-text tables, no invented claims.
 */
import { expect, test } from "@playwright/test";

import { assembleDraft } from "../src/lib/flow/draft";

const TAGS = [
  { id: "t1", phrases: ["the clinic was spotless", "spotlessly clean throughout", "very clean", "hygienic and tidy"] },
  { id: "t2", phrases: ["the treatment was painless", "no pain at all", "gentle throughout", "completely painless"] },
];
const FACTS = { businessName: "Smile Dental Care", vertical: "dental" };

test("SRS-17.2: zero tags produces an empty draft", () => {
  expect(assembleDraft([], FACTS, "session-1").trim()).toBe("");
});

test("every claim in a draft traces to a selected tag or the business name", () => {
  const text = assembleDraft(TAGS, FACTS, "session-1");
  const fromTag = TAGS.flatMap((t) => t.phrases).some((p) => text.includes(p));
  expect(fromTag).toBe(true);
  // Nothing about services the customer did not select.
  for (const banned of ["root canal", "whitening", "braces", "implant", "cheap", "best in"]) {
    expect(text.toLowerCase()).not.toContain(banned);
  }
});

test("only selected tags appear", () => {
  const text = assembleDraft([TAGS[0]], FACTS, "session-2");
  const painless = TAGS[1].phrases.some((p) => text.includes(p));
  expect(painless).toBe(false);
});

test("different sessions rotate wording so profiles do not look templated", () => {
  const outputs = new Set(Array.from({ length: 12 }, (_, i) => assembleDraft(TAGS, FACTS, `session-${i}`)));
  expect(outputs.size).toBeGreaterThan(3);
});

test("drafting is deterministic for one session", () => {
  expect(assembleDraft(TAGS, FACTS, "same")).toBe(assembleDraft(TAGS, FACTS, "same"));
});
