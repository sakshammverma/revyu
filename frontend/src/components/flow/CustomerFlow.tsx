"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlowButton } from "@/components/flow/Button";
import { StarRating } from "@/components/flow/StarRating";
import { TagChips } from "@/components/flow/TagChips";
import { copyToClipboard } from "@/lib/flow/clipboard";
import { clearSavedFlow, loadSavedFlow, saveFlow } from "@/lib/flow/resume";
import { assembleDraft } from "@/lib/flow/draft";
import { submitFeedback, type FeedbackResult, type FlowConfig } from "@/lib/flow/api";
import { createSession } from "@/lib/flow/api";
import { getDeviceHash, getOrCreateSessionId, newId } from "@/lib/flow/identity";
import { retryBuffered, track, type EventType } from "@/lib/flow/events";
import {
  flowStrings,
  GOOGLE_LABEL,
  LANG_NAMES,
  PRIVATE_LABEL,
  rememberFlowLanguage,
  type FlowLang,
  type FlowStrings,
} from "@/lib/flow/strings";

type Step =
  | "rating"
  | "tags"
  | "draft"
  | "handoff"
  | "private"
  | "private_sent"
  // Back from Google: ask how it went (the only signal past the handoff).
  | "returned"
  | "done";

// Written to sessionStorage just before leaving for Google; coming back to it
// opens the "returned" step. Never a visible step itself.
const LEFT_FOR_GOOGLE = "left";

interface Props {
  slug: string;
  config: FlowConfig;
  /** Language the page opens in (decided on the server, so there is no flash). */
  initialLang?: FlowLang;
  /** Languages the customer may switch between. One entry hides the switch. */
  languages?: FlowLang[];
  /** The public try-it page: same flow, with a banner that says so. Use with a preview config. */
  demo?: boolean;
  /** Extra content under the final thank-you (the demo's "get this for your shop"). */
  doneSlot?: ReactNode;
}

// CR-3 / SRS-17.1g: one neutral label, used at every rating (lib/flow/strings.ts).
export { GOOGLE_LABEL, PRIVATE_LABEL };
const PROGRESS_STEPS: Step[] = ["rating", "tags", "draft"];

export function CustomerFlow({ slug, config, initialLang = "en", languages, demo = false, doneSlot }: Props) {
  const sessionId = useMemo(() => getOrCreateSessionId(slug), [slug]);
  const deviceHash = useMemo(() => getDeviceHash(), []);
  const ctx = useMemo(() => ({ outletId: config.outlet.id, sessionId }), [config.outlet.id, sessionId]);
  // Draft outlets (prospecting demos, SRS-11.17) and admin approval previews
  // (SRS-19.2) run the full flow but record nothing: no session, no events,
  // no feedback rows, no trial metering.
  const preview = config.preview === true;
  // SRS-2.5: flow_start means the customer's first interaction, not the page load.
  const started = useRef(false);
  const emit = (type: EventType, payload?: Record<string, unknown>) => {
    if (preview) return;
    if (!started.current) {
      started.current = true;
      track(ctx, "flow_start");
    }
    track(ctx, type, payload);
  };

  const googleUrl = config.outlet.google_review_url;

  const [lang, setLangState] = useState<FlowLang>(initialLang);
  const t = flowStrings(lang);
  const otherLangs = (languages ?? []).filter((l) => l !== lang);

  function setLang(next: FlowLang) {
    setLangState(next);
    rememberFlowLanguage(next);
  }

  const [step, setStepState] = useState<Step>("rating");
  const stepRef = useRef<Step>("rating");
  const [rating, setRating] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [draftEdited, setDraftEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [contact, setContact] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<"failed" | "limited" | null>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const feedbackId = useRef<string | null>(null);
  // Where "Back" returns to from the private-feedback screen.
  const returnStep = useRef<Step>("rating");
  // True between tapping through to Google and coming back to this tab.
  const away = useRef(false);

  useEffect(() => {
    if (preview) return;
    createSession(slug, sessionId, deviceHash);
    retryBuffered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every step is a history entry, so the system back gesture goes to the previous
  // step instead of leaving the page.
  // Entries are stamped with this page load: a reload keeps the old entries' state,
  // and going back to one must not show a step that never happened this time.
  const [loadId] = useState(newId);

  function setStep(next: Step) {
    window.history.pushState({ revyuStep: next, revyuLoad: loadId }, "");
    stepRef.current = next;
    setStepState(next);
  }

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const mine = e.state?.revyuLoad === loadId;
      const next = (mine ? (e.state?.revyuStep as Step | undefined) : undefined) ?? "rating";
      stepRef.current = next;
      setStepState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loadId]);

  // Coming back from Google reloads the page (it is served no-store, so the browser
  // can't restore it). Pick the customer up where they left off for 30 minutes (FR-19).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    const saved = loadSavedFlow(slug, sessionId);
    if (saved && saved.step !== "rating") {
      started.current = true;
      const cameBack = saved.step === LEFT_FOR_GOOGLE;
      const next = (cameBack ? "returned" : saved.step) as Step;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from sessionStorage once on mount (not available during SSR)
      setRating(saved.rating);
      setSelectedTagIds(new Set(saved.tagIds));
      setDraft(saved.draft);
      setDraftEdited(saved.draftEdited);
      window.history.replaceState({ revyuStep: next, revyuLoad: loadId }, "");
      stepRef.current = next;
      setStepState(next);
      if (cameBack) {
        emit("review_return", { rating: saved.rating });
        // Previews keep nothing else, so a reload starts the demo again.
        if (preview) clearSavedFlow(slug);
      }
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preview || !restored.current) return;
    if (step === "private_sent" || step === "done") {
      clearSavedFlow(slug);
      return;
    }
    saveFlow(slug, sessionId, { step, rating, tagIds: Array.from(selectedTagIds), draft, draftEdited });
  }, [preview, slug, sessionId, step, rating, selectedTagIds, draft, draftEdited]);

  // Google often opens in the Maps app or a new tab, leaving this page alive
  // underneath. When the customer comes back to it, ask how it went.
  useEffect(() => {
    const comeBack = () => {
      if (!away.current || document.visibilityState !== "visible") return;
      away.current = false;
      if (preview) clearSavedFlow(slug);
      if (stepRef.current === "returned") return;
      setStep("returned");
      emit("review_return", { rating });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) comeBack();
    };
    document.addEventListener("visibilitychange", comeBack);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", comeBack);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating]);

  // Keep each new screen at the top so the primary action is in view, and move
  // focus to its heading: the button that was pressed has just unmounted, and
  // screen-reader users need to hear where they are.
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const heading = sheetRef.current?.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [step]);

  const positive = rating !== null && rating >= 4;
  const hasDraft = draft.trim().length > 0;

  function handleRate(value: number) {
    setRating(value);
    emit("rating_selected", { rating: value });
    if (value <= 3) {
      returnStep.current = "rating";
      setStep("private");
      emit("private_feedback_opened", { rating: value });
    } else if (config.tags.length === 0) {
      // Nothing to pick from: skip the empty tags screen.
      setDraft("");
      setStep("draft");
      emit("draft_viewed", { tag_count: 0 });
    } else {
      setStep("tags");
    }
  }

  function openPrivate(from: Step) {
    returnStep.current = from;
    emit("private_feedback_opened", { rating });
    setStep("private");
  }

  function handleTagsNext() {
    const tagIds = Array.from(selectedTagIds);
    emit("tags_selected", { tag_ids: tagIds });

    const selectedTags = config.tags
      .filter((tag) => selectedTagIds.has(tag.id))
      .map((tag) => ({ id: tag.id, phrases: tag.phrases }));

    const text = assembleDraft(
      selectedTags,
      { businessName: config.outlet.business_name, vertical: config.outlet.vertical },
      sessionId
    );
    setDraft(text);
    setStep("draft");
    emit("draft_viewed", { tag_count: selectedTagIds.size });
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!draftEdited) {
      setDraftEdited(true);
      emit("draft_edited", { changed: true });
    }
  }

  async function handleCopyAndHandoff() {
    const ok = await copyToClipboard(draft);
    setCopied(ok);
    emit("copy_tapped", { length: draft.length });
    setStep("handoff");
  }

  function goToGoogle() {
    emit("handoff");
    if (!googleUrl) return;
    away.current = true;
    // Written now, not in an effect: the page is about to unload. Holds only what
    // the customer chose on this device, so it is safe for previews too.
    saveFlow(slug, sessionId, {
      step: LEFT_FOR_GOOGLE,
      rating,
      tagIds: Array.from(selectedTagIds),
      draft,
      draftEdited,
    });
    window.location.href = googleUrl;
  }

  // The sticky "Post publicly on Google": still one tap to Google at every step,
  // but the customer's draft goes on the clipboard first instead of being left behind.
  async function stickyGoogle() {
    if ((step === "draft" || step === "returned") && draft.trim()) {
      setCopied(await copyToClipboard(draft));
      // Going back for a second try is the same completed flow, not a new one.
      if (step === "draft") emit("copy_tapped", { length: draft.length });
    }
    goToGoogle();
  }

  function handlePosted() {
    emit("post_confirmed", { rating });
    setStep("done");
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim() || feedbackBusy) return;
    setFeedbackBusy(true);
    setFeedbackError(null);
    // One id per message: a retry after a timeout can't store it twice.
    feedbackId.current ??= newId();
    let result: FeedbackResult = "ok";
    if (!preview) {
      const send = () =>
        submitFeedback(slug, {
          session_id: sessionId,
          rating,
          message: feedbackText,
          contact: contact.trim() || undefined,
          feedback_id: feedbackId.current ?? undefined,
        });
      result = await send();
      if (result === "session") {
        // The session is created fire-and-forget on load; if the customer was
        // offline then, create it now (idempotent) and send again.
        await createSession(slug, sessionId, deviceHash);
        result = await send();
      }
    }
    setFeedbackBusy(false);
    if (result === "ok") {
      feedbackId.current = null;
      setFeedbackText("");
      emit("private_feedback_submitted", { rating });
      setStep("private_sent");
    } else {
      setFeedbackError(result === "limited" ? "limited" : "failed");
    }
  }

  // Back online after a failed send: try again once, without another tap.
  useEffect(() => {
    if (feedbackError !== "failed") return;
    window.addEventListener("online", handleSendFeedback, { once: true });
    return () => window.removeEventListener("online", handleSendFeedback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackError]);

  if (!config.collecting && !preview) {
    return (
      <div lang={lang}>
        <NeutralScreen businessName={config.outlet.business_name} t={t} />
      </div>
    );
  }

  const progressIndex = PROGRESS_STEPS.indexOf(step);
  // Steps where the always-available alternatives live in a sticky bar.
  const showStickyOptions =
    step === "rating" || step === "tags" || step === "draft" || step === "private" || step === "returned" || step === "done";
  // Devanagari sits taller than Latin: give its headings room so matras aren't clipped.
  const titleClass = `font-display tracking-tight text-ink ${lang === "hi" ? "leading-snug" : "leading-tight"}`;
  const h1Class = `${titleClass} text-[26px] sm:text-[28px]`;

  return (
    <>
      <div
        ref={sheetRef}
        lang={lang}
        className={`v2-sheet border border-line p-5 sm:p-8 ${showStickyOptions ? "mb-36" : ""}`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            {config.outlet.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.outlet.logo_url} alt="" width={28} height={28} decoding="async" className="w-7 h-7 rounded-md object-cover shrink-0" />
            ) : (
              <span aria-hidden className="w-2 h-2 rounded-full bg-accent shrink-0" />
            )}
            <span className="text-sm font-semibold text-ink truncate">{config.outlet.business_name}</span>
          </div>
          {otherLangs.length > 0 ? (
            <div className="flex items-center gap-1 shrink-0">
              {otherLangs.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  onClick={() => setLang(l)}
                  aria-label={flowStrings(l).switchTo(LANG_NAMES[l])}
                  className="-my-2 min-h-[44px] flex items-center cursor-pointer [-webkit-tap-highlight-color:transparent] focus-visible:outline-none group"
                >
                  <span className="flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors group-hover:border-accent/60 group-active:bg-accent-50 group-focus-visible:ring-2 group-focus-visible:ring-accent">
                    <GlobeIcon />
                    {LANG_NAMES[l]}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            progressIndex >= 0 && <span className="text-xs text-text-2 shrink-0">{t.stepOf(progressIndex + 1, 3)}</span>
          )}
        </div>

        {progressIndex >= 0 && (
          <div aria-hidden className="flex items-center gap-3 -mt-2 mb-5">
            <div className="flex flex-1 gap-1.5">
              {PROGRESS_STEPS.map((s, i) => (
                <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= progressIndex ? "bg-accent" : "bg-line"}`} />
              ))}
            </div>
            {/* The header's right side holds the language switch, so the count moves here. */}
            {otherLangs.length > 0 && (
              <span className="text-xs text-text-2 tabular-nums shrink-0">{progressIndex + 1}/3</span>
            )}
          </div>
        )}

        {preview && !(demo && step !== "rating") && (
          // SRS-11.17: a demo must never be mistaken for a live install. The public
          // try-it page says so once, on its first screen, and is framed as a demo throughout.
          <p className="mb-5 px-3 py-2 rounded-lg bg-paper-subtle/60 border border-dashed border-line-strong text-xs text-text-2 text-center">
            {demo ? t.demoBanner : t.previewBanner}
          </p>
        )}

        <div key={step} className="flow-step">
        {step === "rating" && (
          <div className="flex flex-col gap-5 text-center">
            <div>
              <h1 className={h1Class}>
                <span className="sr-only">{t.stepOf(1, 3)}. </span>{t.ratingTitle}
              </h1>
              <p className="text-sm text-text-2 mt-1.5">{t.ratingHint}</p>
            </div>
            <div className="py-3 px-2 bg-paper-subtle/50 rounded-2xl border border-line">
              <StarRating value={rating} onChange={handleRate} groupLabel={t.ratingGroup} starLabel={t.rateStar} />
            </div>
          </div>
        )}

        {step === "private" && (
          <PrivateScreen
            t={t}
            titleClass={titleClass}
            positive={positive}
            busy={feedbackBusy}
            error={feedbackError}
            feedbackText={feedbackText}
            onFeedbackChange={setFeedbackText}
            contact={contact}
            onContactChange={setContact}
            feedbackRef={feedbackRef}
            onSend={handleSendFeedback}
            onBack={() => setStep(returnStep.current)}
          />
        )}

        {step === "private_sent" && <PrivateSent t={t} titleClass={titleClass} onGoogle={googleUrl ? goToGoogle : undefined} />}

        {step === "tags" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className={h1Class}>
                <span className="sr-only">{t.stepOf(2, 3)}. </span>{t.tagsTitle}
              </h1>
              <p className="text-sm text-text-2 mt-1.5">{t.tagsHint}</p>
            </div>
            <div className="py-1">
              <TagChips
                tags={config.tags}
                selected={selectedTagIds}
                groupLabel={t.tagsGroup}
                onToggle={(id) => {
                  const next = new Set(selectedTagIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setSelectedTagIds(next);
                }}
              />
            </div>
            <FlowButton variant="primary" onClick={handleTagsNext}>
              {selectedTagIds.size > 0 ? t.tagsNext : t.tagsSkip} →
            </FlowButton>
            <BackLink label={t.back} onClick={() => setStep("rating")} />
          </div>
        )}

        {step === "draft" && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className={h1Class}>
                <span className="sr-only">{t.stepOf(3, 3)}. </span>{t.draftTitle}
              </h1>
              <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-accent-50 border border-accent/25 text-sm font-medium leading-snug text-[#1e4fae]">
                {t.draftNote}
              </div>
            </div>
            <label htmlFor="draft-text" className="sr-only">
              {t.draftTitle}
            </label>
            <textarea
              id="draft-text"
              className="w-full min-h-[140px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
              value={draft}
              enterKeyHint="done"
              placeholder={t.draftPlaceholder}
              onChange={(e) => handleDraftChange(e.target.value)}
            />
            <FlowButton variant="primary" onClick={hasDraft ? handleCopyAndHandoff : goToGoogle} disabled={!googleUrl && !hasDraft}>
              {googleUrl ? <>{hasDraft ? t.copyAndContinue : t.continueToGoogle} →</> : t.copyOnly}
            </FlowButton>
            <BackLink label={t.back} onClick={() => setStep(config.tags.length === 0 ? "rating" : "tags")} />
          </div>
        )}

        {step === "handoff" && <HandoffScreen t={t} copied={copied} onContinue={googleUrl ? goToGoogle : undefined} draft={draft} />}

        {step === "returned" && (
          <ReturnedScreen t={t} titleClass={titleClass} draft={hasDraft ? draft : ""} onPosted={handlePosted} />
        )}

        {step === "done" && <DoneScreen t={t} titleClass={titleClass} slot={doneSlot} />}
        </div>
      </div>

      {/*
        CR-3 / SRS-17.1: at every rating the Google option is on screen, full
        width, ≥44px, one tap from the handoff, and private feedback is always
        reachable as well. A sticky bar keeps both above the fold on a 360×640
        phone no matter how long the page content is.
      */}
      {showStickyOptions && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-sheet border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto flex flex-col gap-1">
            {googleUrl && (
              <FlowButton variant="outline" onClick={stickyGoogle} lang="en">
                {t.googleLabel}
              </FlowButton>
            )}
            {step !== "private" && (
              <button
                type="button"
                lang="en"
                onClick={() => openPrivate(step)}
                className="min-h-[44px] text-sm font-semibold text-accent-hover underline underline-offset-2 cursor-pointer"
              >
                {t.privateLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="w-3.5 h-3.5 text-text-2" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.500-3.900 9c-2.600-2.500-3.900-5.500-3.900-9S9.400 5.500 12 3z" />
    </svg>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] text-sm font-semibold text-text-2 cursor-pointer self-center">
      ← {label}
    </button>
  );
}

function HandoffScreen({ t, copied, draft, onContinue }: { t: FlowStrings; copied: boolean; draft: string; onContinue?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${copied ? "bg-success-50 border-success/25" : "bg-paper-subtle/60 border-line"}`}>
        <span
          aria-hidden
          className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-base font-bold ${copied ? "bg-success text-white" : "bg-line text-ink"}`}
        >
          {copied ? "✓" : "✎"}
        </span>
        <div role="status">
          <h2 className="text-base font-semibold text-ink">{copied ? t.copiedTitle : t.notCopiedTitle}</h2>
          <p className="text-sm text-text-2">{onContinue ? t.readyToPaste : t.pasteAnywhere}</p>
        </div>
      </div>

      {!copied && (
        <div className="text-sm text-ink select-all border border-line bg-paper-subtle/50 rounded-xl p-3.5 leading-relaxed italic">
          &ldquo;{draft}&rdquo;
        </div>
      )}

      {onContinue && <p className="text-sm text-text-2 leading-relaxed">{t.pasteHelp}</p>}

      {onContinue ? (
        <FlowButton variant="primary" onClick={onContinue}>
          {t.openGoogle} →
        </FlowButton>
      ) : (
        <p className="text-sm text-text-2">{t.thanksShort}</p>
      )}
    </div>
  );
}

/**
 * Back from Google. The same screen at every rating: one question, the
 * customer's own draft kept within reach, and the Google option still in the
 * sticky bar for anyone who didn't finish. Nothing is offered for answering.
 */
function ReturnedScreen({
  t,
  titleClass,
  draft,
  onPosted,
}: {
  t: FlowStrings;
  titleClass: string;
  draft: string;
  onPosted: () => void;
}) {
  const [recopied, setRecopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copyAgain() {
    const ok = await copyToClipboard(draft);
    if (!ok) return;
    setRecopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRecopied(false), 2400);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className={`${titleClass} text-2xl sm:text-[26px]`}>{t.returnedTitle}</h1>
        <p className="text-sm text-text-2 mt-1.5 leading-relaxed">{t.returnedHint}</p>
      </div>

      <FlowButton variant="primary" onClick={onPosted}>
        <CheckIcon className="w-5 h-5" />
        {t.postedYes}
      </FlowButton>

      {draft && (
        <div className="rounded-xl border border-line bg-paper-subtle/40 overflow-hidden">
          <div className="flex items-center justify-between gap-3 pl-3.5 pr-1.5 py-1 border-b border-line bg-white/70">
            <span className="text-xs font-semibold text-text-2">{t.draftKept}</span>
            <button
              type="button"
              onClick={copyAgain}
              className="min-h-[40px] px-2.5 flex items-center gap-1.5 text-xs font-semibold text-accent-hover cursor-pointer rounded-lg hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {recopied ? <CheckIcon className="w-4 h-4 text-success-strong" /> : <CopyIcon />}
              <span className={recopied ? "text-success-strong" : ""}>{recopied ? t.copiedAgain : t.copyAgain}</span>
            </button>
            {/* Announced separately: a live region inside the button would hide its name. */}
            <span role="status" className="sr-only">
              {recopied ? t.copiedAgain : ""}
            </span>
          </div>
          <p className="px-3.5 py-3 text-sm text-ink leading-relaxed select-all line-clamp-4">{draft}</p>
        </div>
      )}

      <p className="text-sm text-text-2 leading-relaxed">{draft ? t.notYetWithDraft : t.notYetNoDraft}</p>
    </div>
  );
}

function DoneScreen({ t, titleClass, slot }: { t: FlowStrings; titleClass: string; slot?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 text-center py-2">
      <div aria-hidden className="flow-pop w-14 h-14 rounded-full bg-success text-white flex items-center justify-center mx-auto shadow-v2-rest">
        <CheckIcon className="w-7 h-7" />
      </div>
      <div role="status">
        <h1 className={`${titleClass} text-[28px] sm:text-3xl`}>{t.doneTitle}</h1>
        <p className="text-sm text-text-2 leading-relaxed mt-2 max-w-xs mx-auto">{t.doneBody}</p>
      </div>
      {slot ?? <p className="text-xs text-text-muted">{t.doneClose}</p>}
    </div>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.500A2.500 2.500 0 0 1 7.500 4H15" />
    </svg>
  );
}

function PrivateSent({ t, titleClass, onGoogle }: { t: FlowStrings; titleClass: string; onGoogle?: () => void }) {
  return (
    <div className="flex flex-col gap-4 text-center py-2">
      <div aria-hidden className="w-11 h-11 rounded-full bg-success text-white flex items-center justify-center mx-auto text-lg font-bold">
        ✓
      </div>
      <div role="status">
        <h1 className={`${titleClass} text-2xl sm:text-[26px]`}>{t.sentTitle}</h1>
        <p className="text-sm text-text-2 leading-relaxed mt-2">{t.sentBody}</p>
      </div>
      {onGoogle && (
        <FlowButton variant="outline" onClick={onGoogle} className="mt-1" lang="en">
          {t.googleLabel}
        </FlowButton>
      )}
    </div>
  );
}

function PrivateScreen({
  t,
  titleClass,
  positive,
  busy,
  error,
  feedbackText,
  onFeedbackChange,
  contact,
  onContactChange,
  feedbackRef,
  onSend,
  onBack,
}: {
  t: FlowStrings;
  titleClass: string;
  positive: boolean;
  busy: boolean;
  error: "failed" | "limited" | null;
  feedbackText: string;
  onFeedbackChange: (v: string) => void;
  contact: string;
  onContactChange: (v: string) => void;
  feedbackRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className={`${titleClass} text-2xl sm:text-[26px]`}>
          {positive ? t.privateTitlePositive : t.privateTitleLow}
        </h1>
        <p className="text-sm text-text-2 mt-1.5">{positive ? t.privateHintPositive : t.privateHintLow}</p>
      </div>
      <label htmlFor="private-message" className="text-sm font-semibold text-ink -mb-2">
        {t.privateMessageLabel}
      </label>
      <textarea
        id="private-message"
        ref={feedbackRef}
        maxLength={2000}
        className="w-full min-h-[104px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
        placeholder={positive ? t.privatePlaceholderPositive : t.privatePlaceholderLow}
        value={feedbackText}
        enterKeyHint="done"
        onChange={(e) => onFeedbackChange(e.target.value)}
      />
      <div>
        <label htmlFor="private-contact" className="text-sm font-semibold text-text-2">
          {t.contactLabel}
        </label>
        <input
          id="private-contact"
          value={contact}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => onContactChange(e.target.value)}
          className="mt-1 w-full min-h-[44px] rounded-xl border border-line-strong bg-white px-3.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error === "limited" ? t.errorLimited : t.errorFailed}
        </p>
      )}
      {/* aria-disabled, not disabled: a disabled button drops keyboard focus mid-send. */}
      <FlowButton variant="primary" onClick={onSend} aria-disabled={!feedbackText.trim() || busy} aria-busy={busy}>
        {busy ? t.sending : t.sendPrivately}
      </FlowButton>
      {/* The Google option lives in the sticky bar (CR-3), so it can never fall below the fold here. */}
      {/* Every rating can go back, e.g. to fix a mis-tapped star. */}
      <BackLink label={t.back} onClick={onBack} />
    </div>
  );
}

function NeutralScreen({ businessName, t }: { businessName: string; t: FlowStrings }) {
  return (
    <div className="v2-sheet border border-line px-6 py-10 sm:px-8 text-center flex flex-col items-center gap-3 before:block before:w-10 before:h-1 before:rounded-full before:bg-accent before:mb-3">
      <h1 className="font-display text-2xl leading-tight text-ink">{businessName}</h1>
      <p className="text-sm text-text-2 leading-relaxed max-w-xs">{t.neutral}</p>
    </div>
  );
}
