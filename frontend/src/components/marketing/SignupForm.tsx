"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmSignup,
  searchPlaces,
  submitSignup,
  SignupApiError,
  type PlaceSearchResult,
} from "@/lib/signup/api";
import { CountryPicker } from "@/components/marketing/CountryPicker";
import { Logo } from "@/components/ui/Logo";
import { formatMoney } from "@/lib/format";
import { usePricing } from "@/lib/pricing";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";
import { VERTICAL_OPTIONS } from "@/lib/verticals";

type Step = "details" | "place" | "placement" | "plan";

const STEPS: { key: Step; label: string; note: string; title: string; intro: string }[] = [
  {
    key: "details",
    label: "Your business",
    note: "Name, type and how to reach you",
    title: "Tell us about your business",
    intro: "Your login codes and receipts go to this email.",
  },
  {
    key: "place",
    label: "Google listing",
    note: "So reviews land on your real profile",
    title: "Find your business on Google",
    intro: "Pick your listing. Every review your customers write goes to it.",
  },
  {
    key: "placement",
    label: "QR guidelines",
    note: "Google’s rules, in short",
    title: "Where your QR code can go",
    intro: "Google’s review rules, in two lines. Please read and agree.",
  },
  {
    key: "plan",
    label: "Plan",
    note: "15 days free, nothing charged today",
    title: "Choose your plan",
    intro: "15 days free. You authorise payment now; the first charge comes after the trial.",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same rule as the server: digits with optional + and separators, 7-15 digits. */
function phoneProblem(raw: string): string | null {
  const v = raw.trim();
  if (!/^\+?[0-9\s()-]+$/.test(v)) return "Use digits only in the phone number, like +91 98765 43210.";
  const digits = v.replace(/\D/g, "").length;
  if (digits < 7 || digits > 15) return "That phone number looks too short or too long.";
  return null;
}

const VERTICALS = VERTICAL_OPTIONS.map((o) => o.key);

/** Step-1 answers survive a reload in this tab (sessionStorage), and are dropped after checkout. */
const DRAFT_KEY = "revyu:signup-draft";
type Draft = { businessName: string; vertical: string; ownerName: string; ownerPhone: string; ownerEmail: string };

/**
 * The signup wizard, as a focused full-screen flow rather than a section of a
 * marketing page: every step fits on one screen, the step list stays in view
 * (a rail on desktop, a progress bar on a phone) and Back / Continue sit in a
 * bar that never scrolls away. Moving between steps never needs a scroll.
 */
export function SignupForm({
  initialEmail = "",
  referralCode = "",
  initialPlace,
  initialPlan = "monthly",
}: {
  initialPlan?: "monthly" | "annual";
  initialEmail?: string;
  referralCode?: string;
  /** Preselected Google place (the gap report's "Start free trial" link). */
  initialPlace?: { place_id: string; name: string };
}) {
  const router = useRouter();
  const pricing = usePricing();
  const [step, setStep] = useState<Step>("details");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // State alone can't stop a double tap that lands before the re-render disables the button.
  const inFlight = useRef(false);

  const [businessName, setBusinessName] = useState(initialPlace?.name ?? "");
  const [vertical, setVertical] = useState(VERTICALS[0]);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  // Email pills on the marketing pages link here as /signup?email=...
  const [ownerEmail, setOwnerEmail] = useState(initialEmail);

  const [query, setQuery] = useState(initialPlace?.name ?? "");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(
    initialPlace ? { ...initialPlace, address: "", rating: null, review_count: null } : null,
  );
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [placementAck, setPlacementAck] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual">(initialPlan);

  // Restore after a reload; values from the link (?email=, a gap-report place) win.
  const draftRestored = useRef(false);
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as Partial<Draft> | null;
      if (draft) {
        /* eslint-disable react-hooks/set-state-in-effect -- read a browser-only draft after hydration */
        if (!initialPlace && draft.businessName) setBusinessName(draft.businessName);
        if (draft.vertical && VERTICALS.includes(draft.vertical)) setVertical(draft.vertical);
        if (draft.ownerName) setOwnerName(draft.ownerName);
        if (draft.ownerPhone) setOwnerPhone(draft.ownerPhone);
        if (!initialEmail && draft.ownerEmail) setOwnerEmail(draft.ownerEmail);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
    draftRestored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);
  useEffect(() => {
    if (!draftRestored.current) return;
    try {
      const draft: Draft = { businessName, vertical, ownerName, ownerPhone, ownerEmail };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [businessName, vertical, ownerName, ownerPhone, ownerEmail]);

  async function search(q: string) {
    if (!q.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const r = await searchPlaces(q);
      setResults(r);
      setSearched(true);
      // One clear match: select it, so the owner only has to confirm.
      if (r.length === 1) setSelectedPlace(r[0]);
    } catch (e) {
      setError(e instanceof SignupApiError ? describeError(e.code) : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPlace || inFlight.current || !pricing.ready) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitSignup({
        business_name: businessName,
        vertical,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        owner_email: ownerEmail,
        place_id: selectedPlace.place_id,
        plan,
        expected_currency: pricing.currency ?? undefined,
        placement_acknowledged: placementAck,
        referral_code: referralCode || undefined,
      });
      // SRS-18.6: authorise payment now; the backend verifies the signature
      // and moves the signup into the approval queue (SRS-18.7).
      const result = await runCheckout(res.checkout, businessName);
      // Razorpay has the authorisation now. If our confirm call fails (a
      // flaky mobile network), its webhook moves the signup on anyway, so go
      // to the status page rather than telling the owner to pay again.
      await confirmSignup(res.signup_id, result).catch(() => {});
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push(`/signup/status/${res.signup_id}?paid=1`);
    } catch (e) {
      if (e instanceof CheckoutCancelled) {
        setError("Payment window closed. Nothing was charged — you can try again.");
      } else if (e instanceof SignupApiError && e.code === "PRICE_CHANGED") {
        setError(priceChangedMessage(e.message, pricing.setCountry));
      } else if (e instanceof SignupApiError) {
        setError(describeError(e.code));
      } else if (e instanceof Error && e.message === "PAYMENT_UNAVAILABLE") {
        setError(describeError("PAYMENT_UNAVAILABLE"));
      } else {
        setError("Signup failed.");
      }
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  function continueFromDetails() {
    if (!businessName.trim() || !ownerName.trim() || !ownerPhone.trim() || !ownerEmail.trim()) {
      setError("Fill in all four details to continue.");
      return;
    }
    if (!EMAIL_RE.test(ownerEmail.trim())) {
      setError("Enter a valid email address, like name@business.com. Your login codes go here.");
      return;
    }
    const phoneError = phoneProblem(ownerPhone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    setError(null);
    setStep("place");
    // Search straight away with the name they just typed: most owners only need to confirm.
    if (!selectedPlace && !searched) {
      setQuery(businessName);
      search(businessName);
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[currentStepIndex];

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  // One action per step, from one bar. Enter in any field does the same as the button.
  const action: { label: string; disabled: boolean; run: () => void; hint: string } = {
    details: { label: "Continue", disabled: false, run: continueFromDetails, hint: "About 3 minutes in all" },
    place: {
      label: "Use this listing",
      disabled: !selectedPlace,
      run: () => goTo("placement"),
      hint: selectedPlace ? `Selected: ${selectedPlace.name}` : "Select your listing to continue",
    },
    placement: {
      label: "Continue",
      disabled: !placementAck,
      run: () => goTo("plan"),
      hint: placementAck ? "Thank you" : "Tick the box to continue",
    },
    plan: {
      label: submitting ? "Opening payment…" : "Authorise & start free trial",
      disabled: submitting || !pricing.ready,
      run: handleSubmit,
      hint: "Nothing is charged today",
    },
  }[step];
  const back: Step | null = currentStepIndex > 0 ? STEPS[currentStepIndex - 1].key : null;

  // A new step starts at its top, with focus on its heading for keyboard and screen-reader users.
  const scrollArea = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    scrollArea.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div className="marketing-root min-h-[100dvh] lg:h-[100dvh] bg-bg text-ink lg:grid lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:overflow-hidden">
      {/* Desktop rail: where you are, what's left, and what it costs. */}
      <aside aria-label="Signup steps" className="hidden lg:flex flex-col bg-sheet border-r border-line px-10 py-8 overflow-y-auto">
        <Link href="/" aria-label="Revyu home" className="text-ink self-start">
          <Logo className="text-xl" markClassName="w-6 h-6" />
        </Link>

        <div className="mt-12">
          <p className="font-display text-[2rem] leading-[1.15] text-ink">Start your 15-day free trial</p>
          <p className="mt-3 text-sm text-text-2 leading-relaxed">
            Four short steps. We verify your business before your QR code goes live, so it can never point to the wrong
            listing.
          </p>
        </div>

        <ol className="mt-10 flex flex-col">
          {STEPS.map((s, idx) => {
            const done = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const inner = (
              <>
                <span className="relative flex flex-col items-center self-stretch">
                  <StepBadge n={idx + 1} done={done} current={isCurrent} />
                  {idx < STEPS.length - 1 && (
                    <span aria-hidden className={`flex-1 w-0.5 my-1 rounded-full ${done ? "bg-success" : "bg-line"}`} />
                  )}
                </span>
                <span className="pb-7 text-left">
                  <span className={`block text-sm font-semibold group-hover:text-accent-hover ${isCurrent || done ? "text-ink" : "text-text-2"}`}>
                    {s.label}
                    {done && <span className="sr-only"> (done, select to edit)</span>}
                  </span>
                  <span className="block text-xs text-text-2 mt-0.5">{s.note}</span>
                </span>
              </>
            );
            return (
              <li key={s.key} aria-current={isCurrent ? "step" : undefined}>
                {done ? (
                  <button type="button" onClick={() => goTo(s.key)} className="group w-full flex gap-4 rounded-lg cursor-pointer">
                    {inner}
                  </button>
                ) : (
                  <div className="flex gap-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-auto pt-6 border-t border-line">
          <ul className="flex flex-col gap-2 text-sm text-text-2">
            <Reassure>15 days free, from the day we verify you</Reassure>
            <Reassure>Cancel before the trial ends and pay nothing</Reassure>
            <Reassure>Your QR code never changes</Reassure>
          </ul>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex flex-col min-h-[100dvh] lg:min-h-0 lg:h-full outline-none">
        <h1 className="sr-only">Start your 15-day free trial</h1>

        {/* Phone header: logo, step count and a progress bar that stay on screen. */}
        <header className="lg:hidden sticky top-0 z-20 bg-sheet/95 backdrop-blur border-b border-line">
          <div className="h-14 px-4 flex items-center justify-between gap-3">
            <Link href="/" aria-label="Revyu home" className="text-ink">
              <Logo className="text-lg" markClassName="w-6 h-6" />
            </Link>
            <p className="text-sm text-text-2">
              Step <span className="font-semibold text-ink">{currentStepIndex + 1}</span> of {STEPS.length}
            </p>
          </div>
          <div className="px-4 pb-3 flex gap-1.5" aria-hidden>
            {STEPS.map((s, idx) => (
              <span
                key={s.key}
                className={`h-1 flex-1 rounded-full transition-colors ${idx <= currentStepIndex ? "bg-accent" : "bg-line"}`}
              />
            ))}
          </div>
        </header>

        <div className="hidden lg:flex justify-end px-10 pt-6 text-sm text-text-2">
          Already have an account?&nbsp;
          <Link href="/app/login" className="font-semibold text-accent-hover hover:underline underline-offset-2">
            Log in
          </Link>
        </div>

        <form
          noValidate
          className="flex-1 flex flex-col lg:min-h-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (!action.disabled) action.run();
          }}
        >
          <div ref={scrollArea} className="flex-1 lg:overflow-y-auto">
            <div className="w-full max-w-xl mx-auto px-4 sm:px-8 pt-6 pb-8 lg:pt-10">
              {referralCode && step === "details" && (
                <p className="mb-5 text-sm text-success-strong bg-success-50 border border-success/25 rounded-xl px-4 py-2.5">
                  A fellow business owner invited you. Thank you for trying Revyu.
                </p>
              )}

              <p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">
                Step {currentStepIndex + 1} of {STEPS.length}
                <span className="lg:hidden"> · {current.label}</span>
              </p>
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl sm:text-[1.75rem] leading-tight text-ink mt-2 outline-none">
                {current.title}
              </h2>
              <p className="text-sm text-text-2 mt-1.5">{current.intro}</p>

              {error && (
                <div role="alert" className="mt-5 p-3.5 rounded-xl bg-alert-50 border border-alert/25 text-alert text-sm flex items-start gap-2.5">
                  <span aria-hidden className="mt-px font-bold">!</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6">
                {step === "details" && (
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
                    <Field label="Business name" autoComplete="organization" value={businessName} onChange={setBusinessName} placeholder="e.g. Sharma General Store" />
                    <div>
                      <label htmlFor="business-type" className="block text-sm font-semibold text-ink mb-1.5">
                        Business type
                      </label>
                      <select
                        id="business-type"
                        value={vertical}
                        onChange={(e) => setVertical(e.target.value)}
                        className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
                      >
                        {VERTICAL_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Your name" autoComplete="name" value={ownerName} onChange={setOwnerName} placeholder="e.g. S. Sharma" />
                    </div>
                    <Field label="Phone number" autoComplete="tel" inputMode="tel" value={ownerPhone} onChange={setOwnerPhone} type="tel" placeholder="+91 98765 43210" />
                    <Field label="Work email" autoComplete="email" inputMode="email" value={ownerEmail} onChange={setOwnerEmail} type="email" placeholder="you@yourbusiness.in" />
                  </div>
                )}

                {step === "place" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-2">
                      <input
                        aria-label="Search for your business on Google"
                        className="flex-1 min-w-0 h-12 rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
                        placeholder="Business name and area"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter searches here; it must not submit the step.
                          if (e.key === "Enter") {
                            e.preventDefault();
                            search(query);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => search(query)}
                        disabled={searching || !query.trim()}
                        className="h-12 px-5 rounded-xl border border-line-strong bg-sheet text-sm font-semibold text-ink hover:border-accent disabled:opacity-50 cursor-pointer"
                      >
                        {searching ? "Searching…" : "Search"}
                      </button>
                    </div>

                    {searching ? (
                      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Searching Google">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-[68px] rounded-xl bg-paper-subtle animate-pulse motion-reduce:animate-none" />
                        ))}
                      </div>
                    ) : results.length > 0 ? (
                      <div role="radiogroup" aria-label="Matching Google listings" className="flex flex-col gap-2">
                        {results.map((r) => {
                          const isSelected = selectedPlace?.place_id === r.place_id;
                          return (
                            <button
                              key={r.place_id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setSelectedPlace(r)}
                              className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                                isSelected ? "border-accent bg-accent-50 ring-1 ring-accent" : "border-line bg-sheet hover:border-accent/50"
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? "border-accent" : "border-line-strong"
                                }`}
                              >
                                {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink">{r.name}</span>
                                {r.address && <span className="block text-xs text-text-2 mt-0.5">{r.address}</span>}
                                {r.rating !== null && (
                                  <span className="block text-xs text-text-2 mt-1">
                                    <span className="font-semibold text-ink">★ {r.rating}</span> · {r.review_count} reviews on Google
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : selectedPlace ? (
                      <div className="p-3.5 rounded-xl border border-accent bg-accent-50 ring-1 ring-accent">
                        <span className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Selected listing</span>
                        <p className="text-sm font-semibold text-ink mt-0.5">{selectedPlace.name}</p>
                      </div>
                    ) : searched ? (
                      <p className="text-sm text-text-2 rounded-xl border border-dashed border-line-strong px-4 py-5 text-center">
                        No listings found. Try adding your area, like &ldquo;Sharma Store Indiranagar&rdquo;.
                      </p>
                    ) : null}
                  </div>
                )}

                {step === "placement" && (
                  <div className="flex flex-col gap-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-success-50 border border-success/25">
                        <p className="text-sm font-semibold text-success-strong">Allowed</p>
                        <p className="text-sm text-text-2 mt-1 leading-relaxed">
                          Counter tent cards, bill or receipt footers, window stickers, packaging inserts.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-alert-50 border border-alert/20">
                        <p className="text-sm font-semibold text-alert">Not allowed</p>
                        <p className="text-sm text-text-2 mt-1 leading-relaxed">
                          Your own tablet or kiosk handed to customers, staff watching while they write, and any discount,
                          freebie or reward for a review.
                        </p>
                      </div>
                    </div>

                    <label
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        placementAck ? "border-accent bg-accent-50" : "border-line-strong bg-sheet hover:border-accent/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={placementAck}
                        onChange={(e) => setPlacementAck(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-sm text-ink leading-snug">
                        I understand the Revyu QR code must be printed material (not a business-owned tablet handed to
                        customers), and I agree to place it respectfully.
                      </span>
                    </label>
                  </div>
                )}

                {step === "plan" && (
                  <div className="flex flex-col gap-4">
                    <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PlanOption
                        selected={plan === "monthly"}
                        onSelect={() => setPlan("monthly")}
                        title="Monthly"
                        price={pricing.monthly ?? "…"}
                        period="/month"
                        note="Pay as you go"
                      />
                      <PlanOption
                        selected={plan === "annual"}
                        onSelect={() => setPlan("annual")}
                        title="Annual"
                        price={pricing.annual ?? "…"}
                        period="/year"
                        badge={pricing.saving ? `Save ${pricing.saving}` : undefined}
                        note={pricing.annualPerMonth ? `About ${pricing.annualPerMonth}/mo` : undefined}
                      />
                    </div>
                    <CountryPicker />
                    <ul className="flex flex-col gap-2 p-4 rounded-xl bg-paper-subtle border border-line text-sm text-text-2">
                      <Reassure>Your 15-day trial starts when we verify your business.</Reassure>
                      <Reassure>The first charge comes after the trial. Cancel before then and you pay nothing.</Reassure>
                      <Reassure>If we can&rsquo;t verify your listing, the authorisation is cancelled (or any payment refunded in full).</Reassure>
                    </ul>
                  </div>
                )}
              </div>

              <p className="lg:hidden mt-8 text-sm text-text-2 text-center">
                Already have an account?{" "}
                <Link href="/app/login" className="font-semibold text-accent-hover underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </div>
          </div>

          {/* The step's one action. Pinned: it never scrolls out of reach. */}
          <div className="sticky bottom-0 z-10 bg-sheet/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
            <div className="w-full max-w-xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-3">
              {back && (
                <button
                  type="button"
                  onClick={() => goTo(back)}
                  className="h-12 px-4 rounded-xl border border-line-strong bg-sheet text-sm font-semibold text-ink hover:bg-paper-subtle cursor-pointer"
                >
                  <span aria-hidden>←&nbsp;</span>Back
                </button>
              )}
              <p className="hidden sm:block flex-1 min-w-0 truncate text-xs text-text-2">{action.hint}</p>
              <button
                type="submit"
                disabled={action.disabled}
                className="flex-1 sm:flex-none h-12 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-v2-btn disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer transition-colors"
              >
                {action.label}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function StepBadge({ n, done, current }: { n: number; done: boolean; current: boolean }) {
  return (
    <span
      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
        done
          ? "bg-success border-success text-white"
          : current
            ? "bg-accent border-accent text-white shadow-[0_0_0_4px_var(--color-accent-50)]"
            : "bg-sheet border-line-strong text-text-2"
      }`}
    >
      {done ? (
        <svg aria-hidden viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span aria-hidden>{n}</span>
      )}
    </span>
  );
}

function Reassure({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg aria-hidden viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
}: {
  autoComplete?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-shadow"
      />
    </div>
  );
}

function PlanOption({
  selected,
  onSelect,
  title,
  price,
  period,
  badge,
  note,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  period: string;
  badge?: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border transition-colors cursor-pointer relative ${
        selected ? "border-accent bg-accent-50 ring-1 ring-accent" : "border-line bg-sheet hover:border-accent/50"
      }`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[11px] font-bold bg-accent text-white px-2 py-0.5 rounded-full">{badge}</span>
      )}
      <p className="text-xs font-bold uppercase tracking-wider text-text-2">{title}</p>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-3xl text-ink">{price}</span>
        <span className="text-xs text-text-2 font-medium">{period}</span>
      </div>
      {note && <p className="text-xs text-accent-hover font-semibold mt-1">{note}</p>}
    </button>
  );
}

/**
 * The server charges by the business's own market, which can differ from the
 * market the visitor was shown. Switch the cards to the real price and ask them
 * to review it before anything is charged.
 */
function priceChangedMessage(raw: string, setCountry: (code: string | null) => void): string {
  try {
    const p = JSON.parse(raw) as { country_code: string; currency_code: string; amount_minor: number };
    setCountry(p.country_code);
    return `Pricing for your business's country is ${formatMoney(p.amount_minor, p.currency_code)} for this plan. The plans below now show it. Review and continue when you're ready. Nothing has been charged.`;
  } catch {
    return "The price for your business's country is different from the one shown. Please review the plans and try again.";
  }
}

function describeError(code: string): string {
  switch (code) {
    case "VALIDATION_FAILED":
    case "VALIDATION_ERROR":
      return "Some details don't look right. Check your phone number and email, then try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "DUPLICATE_BUSINESS":
      return "This business, phone, or email is already registered. Contact support if this seems wrong.";
    case "PLACES_UNAVAILABLE":
      return "Business search is temporarily unavailable. Please try again shortly.";
    case "PAYMENT_SIGNATURE_INVALID":
    case "CHECKOUT_MISMATCH":
      return "We couldn't confirm your payment. Nothing has been charged — please try again.";
    case "PAYMENT_UNAVAILABLE":
      return "Payment processing is temporarily unavailable. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}
