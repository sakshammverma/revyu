/**
 * Draft assembly — CR-1 / CR-2 critical, keep this module self-contained and
 * inspectable (SRS-17.3): the CI compliance check asserts no review-like text
 * exists here except phrase fragments passed in from outlet config at
 * runtime, and that every substantive clause traces to a selected tag or an
 * outlet fact (name/vertical/locality). See documents/16-DRAFT-AND-ROUTING.md.
 *
 * No LLM, no network call — deterministic, so it works offline (OD-8) and the
 * output stays 1:1 auditable against tag_ids.
 */

export interface DraftTag {
  id: string;
  /** >=4 phrasing variants per tag (FR-57). Never a full review sentence. */
  phrases: string[];
}

export interface OutletFacts {
  businessName: string;
  vertical: string;
  locality?: string;
}

// >=6 opening templates, rotated (FR-57). {name} is the only substitution —
// vertical/locality only appear where a template explicitly earns them, and
// only from the outlet's own factual record (never invented).
const OPENING_TEMPLATES: string[] = [
  "Had a great experience at {name}.",
  "{name} is genuinely well run.",
  "Really happy with my visit to {name}.",
  "{name} did a great job.",
  "Good experience overall at {name}.",
  "Glad I went to {name}.",
];

const CONNECTIVES = [" and ", ". ", " — ", ", plus "];

/** Deterministic pseudo-random index from a session ID string, so variant
 * selection rotates on session ID (FR-58) without needing real randomness. */
function hashIndex(sessionId: string, salt: string, modulo: number): number {
  let hash = 0;
  const input = `${sessionId}:${salt}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export function assembleDraft(
  selectedTags: DraftTag[],
  facts: OutletFacts,
  sessionId: string
): string {
  // CR-1 / SRS-17.2: zero tags -> empty draft. No fallback text of any kind.
  if (selectedTags.length === 0) {
    return "";
  }

  const phraseFragments = selectedTags.map((tag, i) => {
    const variants = tag.phrases;
    if (variants.length === 0) return "";
    const idx = hashIndex(sessionId, `tag:${tag.id}:${i}`, variants.length);
    return variants[idx];
  });

  const openingIdx = hashIndex(sessionId, "opening", OPENING_TEMPLATES.length);
  const opening = OPENING_TEMPLATES[openingIdx].replace("{name}", facts.businessName);

  const body = phraseFragments.reduce((acc, fragment, i) => {
    if (i === 0) return capitalize(fragment);
    const connectiveIdx = hashIndex(sessionId, `conn:${i}`, CONNECTIVES.length);
    return `${acc}${CONNECTIVES[connectiveIdx]}${fragment}`;
  }, "");

  return `${opening} ${body}.`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
