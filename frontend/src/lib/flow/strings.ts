/**
 * Every word the customer reads in the review flow, per language.
 *
 * CR-3 / SRS-17.1g: the Google option carries one approved neutral label at
 * every rating. `googleLabel` and `privateLabel` therefore stay in the approved
 * English wording in every language until a translated pair has had policy
 * review and been added to APPROVED_LABELS in e2e/compliance.spec.ts. Both are
 * held back together so neither option reads more easily than the other.
 *
 * Nothing here is review text: drafts are built in lib/flow/draft.ts from the
 * customer's own tags (CR-1).
 */

export const FLOW_LANGS = ["en", "hi"] as const;
export type FlowLang = (typeof FLOW_LANGS)[number];

/** How each language names itself, for the switch. */
export const LANG_NAMES: Record<FlowLang, string> = { en: "English", hi: "हिन्दी" };

export const LANG_COOKIE = "revyu_lang";

/** The customer's own choice, kept for a year so their next scan opens in it. */
export function rememberFlowLanguage(lang: FlowLang) {
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // cookies blocked: the choice still holds for this visit
  }
}

export const GOOGLE_LABEL = "Post publicly on Google";
export const PRIVATE_LABEL = "Send private feedback to the owner";

export interface FlowStrings {
  googleLabel: string;
  privateLabel: string;
  switchTo: (name: string) => string;
  stepOf: (n: number, total: number) => string;
  back: string;
  previewBanner: string;
  demoBanner: string;
  neutral: string;

  ratingTitle: string;
  ratingHint: string;
  ratingGroup: string;
  rateStar: (n: number) => string;

  tagsTitle: string;
  tagsHint: string;
  tagsGroup: string;
  tagsNext: string;
  tagsSkip: string;

  draftTitle: string;
  draftNote: string;
  draftPlaceholder: string;
  copyAndContinue: string;
  continueToGoogle: string;
  copyOnly: string;

  copiedTitle: string;
  notCopiedTitle: string;
  readyToPaste: string;
  pasteAnywhere: string;
  pasteHelp: string;
  openGoogle: string;
  thanksShort: string;

  privateTitlePositive: string;
  privateTitleLow: string;
  privateHintPositive: string;
  privateHintLow: string;
  privateMessageLabel: string;
  privatePlaceholderPositive: string;
  privatePlaceholderLow: string;
  contactLabel: string;
  errorLimited: string;
  errorFailed: string;
  sending: string;
  sendPrivately: string;
  sentTitle: string;
  sentBody: string;

  returnedTitle: string;
  returnedHint: string;
  postedYes: string;
  draftKept: string;
  copyAgain: string;
  copiedAgain: string;
  notYetWithDraft: string;
  notYetNoDraft: string;

  doneTitle: string;
  doneBody: string;
  doneClose: string;
}

const en: FlowStrings = {
  googleLabel: GOOGLE_LABEL,
  privateLabel: PRIVATE_LABEL,
  switchTo: (name) => `Switch to ${name}`,
  stepOf: (n, total) => `Step ${n} of ${total}`,
  back: "Back",
  previewBanner: "Preview. This page isn’t live yet, and nothing you do here is recorded.",
  demoBanner: "Demo. This is exactly what your customers see. Nothing here is recorded.",
  neutral: "Not currently collecting feedback. Thank you for stopping by!",

  ratingTitle: "How was your visit?",
  ratingHint: "Tap a star to rate your experience",
  ratingGroup: "Rate your visit",
  rateStar: (n) => `Rate ${n} out of 5 stars`,

  tagsTitle: "What stood out?",
  tagsHint: "Tap whatever applies, or skip this step.",
  tagsGroup: "Select what stood out",
  tagsNext: "Write my draft",
  tagsSkip: "Skip, I’ll write my own",

  draftTitle: "Your review draft",
  draftNote: "We’ve written this from what you selected. Edit anything. It’s your review.",
  draftPlaceholder: "Add a few words in your own words (optional)",
  copyAndContinue: "Copy & Continue to Google",
  continueToGoogle: "Continue to Google",
  copyOnly: "Copy my review",

  copiedTitle: "Copied to your clipboard!",
  notCopiedTitle: "Select and copy your review",
  readyToPaste: "Ready to paste into Google Maps.",
  pasteAnywhere: "Paste it wherever you like to share it.",
  pasteHelp:
    "Next step: on Google, choose your own star rating, then press and hold in the review box and tap Paste. You may need to sign in with your Google account first.",
  openGoogle: "Open Google Review Page",
  thanksShort: "Thank you for your feedback!",

  privateTitlePositive: "Anything the owner should know?",
  privateTitleLow: "Sorry that didn’t go well.",
  privateHintPositive: "Only the owner sees this. It’s separate from your Google review.",
  privateHintLow: "Tell them directly. Only the owner will see this.",
  privateMessageLabel: "Your private message",
  privatePlaceholderPositive: "Your message to the owner",
  privatePlaceholderLow: "What went wrong with your visit?",
  contactLabel: "Phone or email (optional, only if you’d like a reply)",
  errorLimited: "Many people are using this network right now. Please try again in a few minutes.",
  errorFailed: "We couldn’t send that. Check your connection and try again; we’ll also retry when you’re back online.",
  sending: "Sending…",
  sendPrivately: "Send privately to the owner",
  sentTitle: "Message sent directly to the owner.",
  sentBody: "Thank you. If you would still like to share publicly, you are always welcome to post on Google.",

  returnedTitle: "Did your review go through?",
  returnedHint: "Posting happens on Google, so we can’t see it from here.",
  postedYes: "Yes, I posted it",
  draftKept: "Your draft is still here",
  copyAgain: "Copy again",
  copiedAgain: "Copied",
  notYetWithDraft: "Not yet? Use the Google button below. We’ll copy your draft again first, so it’s ready to paste.",
  notYetNoDraft: "Not yet? The Google button below takes you straight back.",

  doneTitle: "Thank you.",
  doneBody: "Thanks for taking the time. Honest reviews help the next person decide.",
  doneClose: "You can close this page now.",
};

const hi: FlowStrings = {
  googleLabel: GOOGLE_LABEL,
  privateLabel: PRIVATE_LABEL,
  switchTo: (name) => `${name} में देखें`,
  stepOf: (n, total) => `चरण ${n} / ${total}`,
  back: "वापस",
  previewBanner: "प्रीव्यू। यह पेज अभी लाइव नहीं है, और यहाँ कुछ भी रिकॉर्ड नहीं होता।",
  demoBanner: "डेमो। आपके ग्राहक ठीक यही देखते हैं। यहाँ कुछ भी रिकॉर्ड नहीं होता।",
  neutral: "अभी फ़ीडबैक नहीं लिया जा रहा है। आने के लिए धन्यवाद!",

  ratingTitle: "आपका अनुभव कैसा रहा?",
  ratingHint: "रेटिंग देने के लिए स्टार पर टैप करें",
  ratingGroup: "अपने अनुभव को रेटिंग दें",
  rateStar: (n) => `5 में से ${n} स्टार दें`,

  tagsTitle: "आपको क्या ख़ास लगा?",
  tagsHint: "जो सही लगे उसे चुनें, या यह चरण छोड़ दें।",
  tagsGroup: "चुनें कि क्या ख़ास लगा",
  tagsNext: "मेरा ड्राफ़्ट बनाएँ",
  tagsSkip: "छोड़ें, ख़ुद लिखना है",

  draftTitle: "आपके रिव्यू का ड्राफ़्ट",
  draftNote: "यह आपके चुने हुए विकल्पों से लिखा गया है। जो चाहें बदलें। यह आपका रिव्यू है।",
  draftPlaceholder: "अपने शब्दों में कुछ लिखें (वैकल्पिक)",
  copyAndContinue: "कॉपी करें और Google पर जाएँ",
  continueToGoogle: "Google पर जाएँ",
  copyOnly: "मेरा रिव्यू कॉपी करें",

  copiedTitle: "कॉपी हो गया!",
  notCopiedTitle: "अपना रिव्यू चुनकर कॉपी करें",
  readyToPaste: "अब इसे Google Maps में पेस्ट करें।",
  pasteAnywhere: "इसे जहाँ चाहें पेस्ट करके शेयर करें।",
  pasteHelp:
    "आगे: Google पर अपनी स्टार रेटिंग ख़ुद चुनें, फिर रिव्यू बॉक्स को दबाकर रखें और Paste पर टैप करें। हो सकता है पहले अपने Google अकाउंट से साइन इन करना पड़े।",
  openGoogle: "Google रिव्यू पेज खोलें",
  thanksShort: "आपकी राय के लिए धन्यवाद!",

  privateTitlePositive: "मालिक को कुछ बताना चाहेंगे?",
  privateTitleLow: "खेद है कि अनुभव अच्छा नहीं रहा।",
  privateHintPositive: "इसे सिर्फ़ मालिक देखेंगे। यह आपके Google रिव्यू से अलग है।",
  privateHintLow: "सीधे उन्हें बताएँ। इसे सिर्फ़ मालिक देखेंगे।",
  privateMessageLabel: "आपका निजी संदेश",
  privatePlaceholderPositive: "मालिक के लिए आपका संदेश",
  privatePlaceholderLow: "क्या ठीक नहीं रहा?",
  contactLabel: "फ़ोन या ईमेल (वैकल्पिक, अगर आप जवाब चाहते हैं)",
  errorLimited: "इस नेटवर्क से अभी बहुत लोग जुड़े हैं। कुछ मिनट बाद फिर कोशिश करें।",
  errorFailed: "संदेश नहीं भेजा जा सका। इंटरनेट जाँचकर फिर कोशिश करें; ऑनलाइन आते ही हम भी दोबारा भेजेंगे।",
  sending: "भेजा जा रहा है…",
  sendPrivately: "मालिक को निजी तौर पर भेजें",
  sentTitle: "संदेश सीधे मालिक को भेज दिया गया।",
  sentBody: "धन्यवाद। अगर आप सार्वजनिक रूप से भी बताना चाहें, तो Google पर कभी भी पोस्ट कर सकते हैं।",

  returnedTitle: "क्या आपका रिव्यू पोस्ट हो गया?",
  returnedHint: "पोस्ट Google पर होता है, इसलिए हम यहाँ से नहीं देख सकते।",
  postedYes: "हाँ, पोस्ट कर दिया",
  draftKept: "आपका ड्राफ़्ट यहीं है",
  copyAgain: "फिर से कॉपी करें",
  copiedAgain: "कॉपी हो गया",
  notYetWithDraft: "अभी नहीं? नीचे Google वाला बटन दबाएँ। हम पहले आपका ड्राफ़्ट फिर से कॉपी कर देंगे, ताकि आप उसे पेस्ट कर सकें।",
  notYetNoDraft: "अभी नहीं? नीचे Google वाला बटन आपको सीधे वापस ले जाएगा।",

  doneTitle: "धन्यवाद।",
  doneBody: "समय निकालने के लिए धन्यवाद। सच्चे रिव्यू अगले ग्राहक को फ़ैसला करने में मदद करते हैं।",
  doneClose: "अब आप यह पेज बंद कर सकते हैं।",
};

const STRINGS: Record<FlowLang, FlowStrings> = { en, hi };

export function flowStrings(lang: FlowLang): FlowStrings {
  return STRINGS[lang];
}

function primaryTag(tag: string | null | undefined): FlowLang | null {
  const primary = (tag ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return (FLOW_LANGS as readonly string[]).includes(primary) ? (primary as FlowLang) : null;
}

/** Languages in an Accept-Language header, most preferred first. */
function acceptedLanguages(header: string | null | undefined): string[] {
  return (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((l) => l.tag && l.tag !== "*" && l.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((l) => l.tag);
}

/**
 * Which language the flow opens in, and which ones the switch offers.
 *
 * Opens in: the customer's own earlier choice, else the outlet's language,
 * else the phone's first language, else English. The switch is offered only
 * when a second language is relevant (the outlet's, or one the phone lists),
 * so an English-only shop's customers never see a language they didn't ask for.
 */
export function resolveFlowLanguage(input: {
  saved?: string | null;
  outletLocale?: string | null;
  acceptLanguage?: string | null;
}): { lang: FlowLang; offered: FlowLang[] } {
  const saved = primaryTag(input.saved);
  const outlet = primaryTag(input.outletLocale);
  const phone = acceptedLanguages(input.acceptLanguage);
  const phoneFirst = primaryTag(phone[0]);
  const phoneAny = phone.map(primaryTag).filter((l): l is FlowLang => l !== null);

  const relevant = new Set<FlowLang>(["en"]);
  for (const l of [saved, outlet, ...phoneAny]) if (l) relevant.add(l);

  const lang = saved ?? (outlet && outlet !== "en" ? outlet : null) ?? phoneFirst ?? outlet ?? "en";
  return { lang, offered: FLOW_LANGS.filter((l) => relevant.has(l)) };
}
