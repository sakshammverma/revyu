/**
 * Presenter cues for the in-shop sales demo (/marketing). Data only: the deck shows these on
 * the presenter's screen, never to a customer. The full script lives in
 * founder/sales-demo-script.md; keep the two in step.
 *
 * Placeholders: {name} the shop, {m} its Google review count, {rival} the top nearby shop,
 * {n} that shop's review count, {price} the monthly price, {perDay} about that per day.
 * A cue whose placeholders have no value is skipped (see cueReady), so a shop with no
 * rivals or a price that failed to load never shows a half-filled line.
 *
 * Rules the cues follow: no promised review counts, rating or rank; no claims about the
 * rival; no "only happy customers"; no deadlines; the customer writes and posts.
 */
import type { DeckStep } from "@/lib/marketing/salesTypes";

export type CueVars = Partial<Record<"name" | "m" | "rival" | "n" | "price" | "perDay", string | number | null | undefined>>;

export const SAY: Record<DeckStep | "open", string[]> = {
  open: [
    "Namaste, main Revyu se hoon. Aapki shop ka Google pe ek cheez dikhani thi — 2 minute.",
    "Aapke {m} reviews hain, paas mein {rival} ke {n}.",
    "Maine aapke liye kuch banaya hai — dikhaun?",
  ],
  gap: [
    "Customer jab Google pe search karta hai, dono shops saath dikhti hain.",
    "Jitne zyada customers se puchoge, utne zyada log likhenge.",
  ],
  try: [
    "Ye standee aapke counter pe, aapke naam ke saath.",
    "Apne phone se scan kijiye — bilkul waise jaise customer karega.",
    "Try ke baad: Type kuch nahi, bas tap. Draft unke apne taps se.",
    "Google ka button har customer ko — naraaz ko bhi. Yahi Google ka rule hai, isliye profile safe.",
  ],
  dashboard: [
    "Upar aapki asli Google rating, har hafte check.",
    "Ye paas ki shops ke saath race, har Monday.",
    "Koi naraaz hua toh private message aapko — yahin se call ya WhatsApp.",
    "Ye activity numbers example hain; asli pehle scan se.",
  ],
  start: [
    "15 din free, aaj kuch charge nahi; trial mein cancel kiya toh ek rupaya nahi.",
    "Phir {price} mahina — din ka lagbhag {perDay}.",
    "Abhi aapke saath set kar deta hoon — ye QR scan kijiye, shop pehle se bhari hai.",
  ],
};

/** Honest answers. `q` is how the owner says it; `a` is what to say back. */
export const OBJECTIONS: { q: string; a: string }[] = [
  {
    q: "Google ka QR free hai",
    a: "Free QR gives a blank box. We draft the first line from their taps, bring complaints to you privately, and show weekly numbers vs nearby shops.",
  },
  {
    q: "Sirf khush customers ko Google bhejo",
    a: "No — that's review gating; Google removes reviews and acts on profiles for it. Every customer sees Google; unhappy ones can also tell you privately first.",
  },
  {
    q: "Guarantee?",
    a: "No guarantees. You'll see scans and your Google count every week; 15 free days to judge.",
  },
  {
    q: "Staff bhool jayega",
    a: "The QR asks every customer by itself; I'll teach your staff one line; the dashboard shows when scans drop.",
  },
  {
    q: "Mehenga",
    a: "About {perDay} a day; one extra customer a month covers it; first 15 days free.",
  },
  {
    q: "Google penalty?",
    a: "Built to Google's rules: Google button for everyone, no rewards, the customer writes and posts.",
  },
  {
    q: "Draft fake lagega",
    a: "It's built only from the customer's own taps; they edit and post from their own account.",
  },
  {
    q: "Cancel?",
    a: "Any time from your dashboard; cancel in the trial and pay nothing.",
  },
  {
    q: "Hum already bolte hain",
    a: "Staff ask who they chat with, when they remember; the QR asks everyone, every time.",
  },
  {
    q: "Details bhejo / sochenge",
    a: "Start the free trial now — nothing charged; or tell me a day and I'll set it up in 10 minutes.",
  },
];

const PLACEHOLDER = /\{(\w+)\}/g;

function present(v: CueVars[keyof CueVars]): v is string | number {
  return v !== null && v !== undefined && v !== "";
}

/** True when every {placeholder} in the cue has a value. */
export function cueReady(template: string, vars: CueVars): boolean {
  for (const m of template.matchAll(PLACEHOLDER)) {
    if (!present(vars[m[1] as keyof CueVars])) return false;
  }
  return true;
}

/** Fills {placeholders}; an unknown or empty one is left as written. */
export function fillCue(template: string, vars: CueVars): string {
  return template.replace(PLACEHOLDER, (whole, key: string) => {
    const v = vars[key as keyof CueVars];
    return present(v) ? String(v) : whole;
  });
}
