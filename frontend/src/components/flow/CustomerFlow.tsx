"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlowButton } from "@/components/flow/Button";
import { StarRating } from "@/components/flow/StarRating";
import { TagChips } from "@/components/flow/TagChips";
import { copyToClipboard } from "@/lib/flow/clipboard";
import { assembleDraft } from "@/lib/flow/draft";
import { submitFeedback, type FlowConfig } from "@/lib/flow/api";
import { createSession } from "@/lib/flow/api";
import { getDeviceHash, getOrCreateSessionId } from "@/lib/flow/identity";
import { retryBuffered, track, type EventType } from "@/lib/flow/events";

type Step =
  | "landing"
  | "rating"
  | "tags"
  | "draft"
  | "handoff"
  | "private"
  | "private_sent";

interface Props {
  slug: string;
  config: FlowConfig;
}

// CR-3 / SRS-17.1g: one neutral label, used at every rating.
const GOOGLE_LABEL = "Post publicly on Google";
const PRIVATE_LABEL = "Send private feedback to the owner";
const PROGRESS_STEPS: Step[] = ["rating", "tags", "draft"];

export function CustomerFlow({ slug, config }: Props) {
  const sessionId = useMemo(() => getOrCreateSessionId(slug), [slug]);
  const deviceHash = useMemo(() => getDeviceHash(), []);
  const ctx = useMemo(() => ({ outletId: config.outlet.id, sessionId }), [config.outlet.id, sessionId]);
  // Draft outlets (prospecting demos, SRS-11.17) and admin approval previews
  // (SRS-19.2) run the full flow but record nothing: no session, no events,
  // no feedback rows, no trial metering.
  const preview = config.preview === true;
  const emit = (type: EventType, payload?: Record<string, unknown>) => {
    if (!preview) track(ctx, type, payload);
  };

  const googleUrl = config.outlet.google_review_url;

  const [step, setStep] = useState<Step>("landing");
  const [rating, setRating] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [draftEdited, setDraftEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [contact, setContact] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  // Where "Back" returns to from the private-feedback screen.
  const returnStep = useRef<Step>("rating");

  useEffect(() => {
    if (preview) return;
    createSession(slug, sessionId, deviceHash);
    retryBuffered(ctx);
    track(ctx, "flow_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep each new screen at the top so the primary action is in view.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const positive = rating !== null && rating >= 4;

  function handleRate(value: number) {
    setRating(value);
    emit("rating_selected", { rating: value });
    if (value <= 3) {
      returnStep.current = "rating";
      setStep("private");
      emit("private_feedback_opened", { rating: value });
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
      .filter((t) => selectedTagIds.has(t.id))
      .map((t) => ({ id: t.id, phrases: t.phrases }));

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
    if (googleUrl) window.location.href = googleUrl;
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim() || feedbackBusy) return;
    setFeedbackBusy(true);
    setFeedbackError(false);
    const ok = preview
      ? true
      : await submitFeedback(slug, {
          session_id: sessionId,
          rating,
          message: feedbackText,
          contact: contact.trim() || undefined,
        });
    setFeedbackBusy(false);
    if (ok) {
      emit("private_feedback_submitted", { rating });
      setStep("private_sent");
    } else {
      setFeedbackError(true);
    }
  }

  if (!config.collecting && !preview) {
    return <NeutralScreen businessName={config.outlet.business_name} />;
  }

  const progressIndex = PROGRESS_STEPS.indexOf(step);
  // Steps where the always-available alternatives live in a sticky bar.
  const showStickyOptions = step === "rating" || step === "tags" || step === "draft";

  return (
    <>
      <div className={`v2-sheet border border-line p-5 sm:p-8 ${showStickyOptions ? "mb-36" : ""}`}>
        {/* Brand header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            {config.outlet.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.outlet.logo_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
            ) : (
              <span aria-hidden className="w-2 h-2 rounded-full bg-accent shrink-0" />
            )}
            <span className="text-sm font-semibold text-ink truncate">{config.outlet.business_name}</span>
          </div>
          {progressIndex >= 0 && (
            <span className="text-xs text-text-2 shrink-0" aria-label={`Step ${progressIndex + 1} of 3`}>
              Step {progressIndex + 1} of 3
            </span>
          )}
        </div>

        {progressIndex >= 0 && (
          <div aria-hidden className="flex gap-1.5 -mt-2 mb-5">
            {PROGRESS_STEPS.map((s, i) => (
              <span key={s} className={`h-1 flex-1 rounded-full ${i <= progressIndex ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
        )}

        {preview && (
          // SRS-11.17: a demo must never be mistaken for a live install.
          <p className="mb-5 px-3 py-2 rounded-lg bg-paper-subtle/60 border border-dashed border-line-strong text-xs text-text-2 text-center">
            Preview. This page isn&rsquo;t live yet, and nothing you do here is recorded.
          </p>
        )}

        {step === "landing" && <Landing businessName={config.outlet.business_name} onStart={() => setStep("rating")} />}

        {step === "rating" && (
          <div className="flex flex-col gap-5 text-center">
            <div>
              <h1 className="font-display text-[26px] sm:text-[28px] leading-tight tracking-tight text-ink">How was your visit?</h1>
              <p className="text-sm text-text-2 mt-1.5">Tap a star to rate your experience</p>
            </div>
            <div className="py-3 px-2 bg-paper-subtle/50 rounded-2xl border border-line">
              <StarRating value={rating} onChange={handleRate} />
            </div>
          </div>
        )}

        {step === "private" && (
          <PrivateScreen
            positive={positive}
            busy={feedbackBusy}
            error={feedbackError}
            feedbackText={feedbackText}
            onFeedbackChange={setFeedbackText}
            contact={contact}
            onContactChange={setContact}
            feedbackRef={feedbackRef}
            onSend={handleSendFeedback}
            onGoogle={googleUrl ? goToGoogle : undefined}
            onBack={() => setStep(returnStep.current)}
            autoFocus={!positive}
          />
        )}

        {step === "private_sent" && <PrivateSent onGoogle={googleUrl ? goToGoogle : undefined} />}

        {step === "tags" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-[26px] sm:text-[28px] leading-tight tracking-tight text-ink">What stood out?</h1>
              <p className="text-sm text-text-2 mt-1.5">Tap whatever applies, or skip to continue.</p>
            </div>
            <div className="py-1">
              <TagChips
                tags={config.tags}
                selected={selectedTagIds}
                onToggle={(id) => {
                  const next = new Set(selectedTagIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setSelectedTagIds(next);
                }}
              />
            </div>
            <FlowButton variant="primary" onClick={handleTagsNext}>
              Assemble my review →
            </FlowButton>
            <BackLink onClick={() => setStep("rating")} />
          </div>
        )}

        {step === "draft" && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-[26px] sm:text-[28px] leading-tight tracking-tight text-ink">Your review draft</h1>
              <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-accent-50 border border-accent/25 text-sm font-medium leading-snug text-[#1e4fae]">
                We&rsquo;ve written this from what you selected. Edit anything. It&rsquo;s your review.
              </div>
            </div>
            <label htmlFor="draft-text" className="sr-only">
              Your review draft
            </label>
            <textarea
              id="draft-text"
              className="w-full min-h-[140px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
            />
            <FlowButton variant="primary" onClick={handleCopyAndHandoff} disabled={!googleUrl && !draft.trim()}>
              Copy &amp; Continue to Google →
            </FlowButton>
            <BackLink onClick={() => setStep("tags")} />
          </div>
        )}

        {step === "handoff" && <HandoffScreen copied={copied} onContinue={googleUrl ? goToGoogle : undefined} draft={draft} />}
      </div>

      {/*
        CR-3 / SRS-17.1: at every rating the Google option is on screen, full
        width, ≥44px, one tap from the handoff, and private feedback is always
        reachable as well. A sticky bar keeps both above the fold on a 360×640
        phone no matter how long the page content is.
      */}
      {showStickyOptions && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-sheet/95 backdrop-blur border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto flex flex-col gap-1">
            {googleUrl && (
              <FlowButton variant="outline" onClick={goToGoogle}>
                {GOOGLE_LABEL}
              </FlowButton>
            )}
            <button
              type="button"
              onClick={() => openPrivate(step)}
              className="min-h-[44px] text-sm font-semibold text-accent-hover underline underline-offset-2 cursor-pointer"
            >
              {PRIVATE_LABEL}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] text-sm font-semibold text-text-2 cursor-pointer self-center">
      ← Back
    </button>
  );
}

function Landing({ businessName, onStart }: { businessName: string; onStart: () => void }) {
  return (
    <div className="flex flex-col gap-5 text-center py-2">
      <div aria-hidden className="w-14 h-14 rounded-2xl bg-[#fff7e6] border border-[#f5a524]/25 flex items-center justify-center mx-auto text-2xl">
        ⭐
      </div>
      <div>
        <h1 className="font-display text-[26px] sm:text-[28px] leading-tight tracking-tight text-ink">How was your visit today?</h1>
        <p className="text-sm text-text-2 leading-relaxed mt-2 max-w-xs mx-auto">
          Share quick feedback for <strong className="font-semibold text-ink">{businessName}</strong>. Takes less than 30 seconds.
        </p>
      </div>
      <FlowButton variant="primary" onClick={onStart}>
        Start review →
      </FlowButton>
    </div>
  );
}

function HandoffScreen({ copied, draft, onContinue }: { copied: boolean; draft: string; onContinue?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="p-3.5 rounded-xl bg-success-50 border border-success/25 flex items-center gap-3">
        <span aria-hidden className="w-9 h-9 shrink-0 rounded-full bg-success text-white flex items-center justify-center text-base font-bold">
          ✓
        </span>
        <div role="status">
          <h2 className="text-base font-semibold text-ink">{copied ? "Copied to your clipboard!" : "Select and copy your review"}</h2>
          <p className="text-sm text-text-2">Ready to paste into Google Maps.</p>
        </div>
      </div>

      {!copied && (
        <div className="text-sm text-ink select-all border border-line bg-paper-subtle/50 rounded-xl p-3.5 leading-relaxed italic">
          &ldquo;{draft}&rdquo;
        </div>
      )}

      <p className="text-sm text-text-2 leading-relaxed">
        Next step: paste your draft into Google Maps. You may need to sign in with your Google account first.
      </p>

      {onContinue ? (
        <FlowButton variant="primary" onClick={onContinue}>
          Open Google Review Page →
        </FlowButton>
      ) : (
        <p className="text-sm text-text-2">Thank you for your feedback!</p>
      )}
    </div>
  );
}

function PrivateSent({ onGoogle }: { onGoogle?: () => void }) {
  return (
    <div className="flex flex-col gap-4 text-center py-2">
      <div aria-hidden className="w-11 h-11 rounded-full bg-success text-white flex items-center justify-center mx-auto text-lg font-bold">
        ✓
      </div>
      <div role="status">
        <h1 className="font-display text-2xl sm:text-[26px] leading-tight tracking-tight text-ink">Message sent directly to the owner.</h1>
        <p className="text-sm text-text-2 leading-relaxed mt-2">
          Thank you. If you would still like to share publicly, you are always welcome to post on Google.
        </p>
      </div>
      {onGoogle && (
        <FlowButton variant="outline" onClick={onGoogle} className="mt-1">
          {GOOGLE_LABEL}
        </FlowButton>
      )}
    </div>
  );
}

function PrivateScreen({
  positive,
  busy,
  error,
  feedbackText,
  onFeedbackChange,
  contact,
  onContactChange,
  feedbackRef,
  onSend,
  onGoogle,
  onBack,
  autoFocus,
}: {
  positive: boolean;
  busy: boolean;
  error: boolean;
  feedbackText: string;
  onFeedbackChange: (v: string) => void;
  contact: string;
  onContactChange: (v: string) => void;
  feedbackRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
  onGoogle?: () => void;
  onBack: () => void;
  autoFocus: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl sm:text-[26px] leading-tight tracking-tight text-ink">
          {positive ? "Anything the owner should know?" : "Sorry that didn’t go well."}
        </h1>
        <p className="text-sm text-text-2 mt-1.5">
          {positive
            ? "Only the owner sees this. It’s separate from your Google review."
            : "Tell them directly. The owner sees private feedback today."}
        </p>
      </div>
      <label htmlFor="private-message" className="sr-only">
        Your private message
      </label>
      <textarea
        id="private-message"
        ref={feedbackRef}
        autoFocus={autoFocus}
        maxLength={2000}
        className="w-full min-h-[104px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
        placeholder={positive ? "Your message to the owner" : "What went wrong with your visit?"}
        value={feedbackText}
        onChange={(e) => onFeedbackChange(e.target.value)}
      />
      <div>
        <label htmlFor="private-contact" className="text-xs font-semibold text-text-2">
          Phone or email (optional, only if you&rsquo;d like a reply)
        </label>
        <input
          id="private-contact"
          value={contact}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => onContactChange(e.target.value)}
          className="mt-1 w-full min-h-[44px] rounded-xl border border-line-strong bg-white px-3.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-alert">
          We couldn&rsquo;t send that. Please check your connection and try again.
        </p>
      )}
      <FlowButton variant="primary" onClick={onSend} disabled={!feedbackText.trim() || busy}>
        {busy ? "Sending…" : "Send privately to the owner"}
      </FlowButton>
      {onGoogle && (
        <>
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full h-px bg-line" />
            <span className="absolute bg-white px-3 text-xs font-medium tracking-wider text-text-2 uppercase">or</span>
          </div>
          <FlowButton variant="outline" onClick={onGoogle}>
            {GOOGLE_LABEL}
          </FlowButton>
        </>
      )}
      {positive && <BackLink onClick={onBack} />}
    </div>
  );
}

function NeutralScreen({ businessName }: { businessName: string }) {
  return (
    <div className="v2-sheet border border-line px-6 py-10 sm:px-8 text-center flex flex-col items-center gap-3 before:block before:w-10 before:h-1 before:rounded-full before:bg-accent before:mb-3">
      <span className="font-display text-2xl leading-tight text-ink">{businessName}</span>
      <p className="text-sm text-text-2 leading-relaxed max-w-xs">Not currently collecting feedback. Thank you for stopping by!</p>
    </div>
  );
}
