"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmSignup,
  searchPlaces,
  submitSignup,
  SignupApiError,
  type PlaceSearchResult,
} from "@/lib/signup/api";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";

type Step = "details" | "place" | "placement" | "plan";

const STEPS: { key: Step; label: string; number: string }[] = [
  { key: "details", label: "Business", number: "1" },
  { key: "place", label: "Google Place", number: "2" },
  { key: "placement", label: "Guidelines", number: "3" },
  { key: "plan", label: "Plan", number: "4" },
];

const VERTICALS = ["general", "dental", "physiotherapy", "gym", "salon", "coaching"];

export function SignupForm({ initialEmail = "", referralCode = "" }: { initialEmail?: string; referralCode?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [vertical, setVertical] = useState(VERTICALS[0]);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  // Email pills on the marketing pages link here as /signup?email=...
  const [ownerEmail, setOwnerEmail] = useState(initialEmail);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [placementAck, setPlacementAck] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const r = await searchPlaces(query);
      setResults(r);
    } catch (e) {
      setError(e instanceof SignupApiError ? describeError(e.code) : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPlace) return;
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
        placement_acknowledged: placementAck,
        referral_code: referralCode || undefined,
      });
      // SRS-18.6: authorise payment now; the backend verifies the signature
      // and moves the signup into the approval queue (SRS-18.7).
      const result = await runCheckout(res.checkout, businessName);
      await confirmSignup(res.signup_id, result);
      router.push(`/signup/status/${res.signup_id}`);
    } catch (e) {
      if (e instanceof CheckoutCancelled) {
        setError("Payment window closed. Nothing was charged — you can try again.");
      } else if (e instanceof SignupApiError) {
        setError(describeError(e.code));
      } else if (e instanceof Error && e.message === "PAYMENT_UNAVAILABLE") {
        setError(describeError("PAYMENT_UNAVAILABLE"));
      } else {
        setError("Signup failed.");
      }
      setSubmitting(false);
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="v2-sheet p-6 sm:p-8 max-w-2xl mx-auto border border-line shadow-v2-rest">
      {/* Progress Steps Header */}
      <div className="mb-8 pb-5 border-b border-line">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = s.key === step;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                    isCurrent
                      ? "bg-brand text-white shadow-xs"
                      : isCompleted
                      ? "bg-positive text-white"
                      : "bg-paper-subtle text-ink-muted border border-line"
                  }`}
                >
                  {isCompleted ? "✓" : s.number}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    isCurrent ? "text-ink" : "text-ink-disabled"
                  }`}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className="hidden sm:block w-8 sm:w-12 h-px bg-line ml-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-urgency/40 text-urgency text-xs sm:text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Business Details */}
      {step === "details" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-ink">Tell us about your business</h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Basic details to initialize your verified outlet.
            </p>
          </div>

          <Field label="Business name" value={businessName} onChange={setBusinessName} placeholder="e.g. Sharma General Store" />
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
              Business type
            </label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper-subtle/50 px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:bg-white transition-colors"
            >
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {v === "general" ? "Shop / other business" : v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <Field label="Owner / Manager name" value={ownerName} onChange={setOwnerName} placeholder="e.g. S. Sharma" />
          <Field label="Phone number" value={ownerPhone} onChange={setOwnerPhone} type="tel" placeholder="+91 98765 43210" />
          <Field label="Work email" value={ownerEmail} onChange={setOwnerEmail} type="email" placeholder="you@yourbusiness.in" />

          <div className="mt-4 pt-4 border-t border-line flex justify-end">
            <button
              disabled={!businessName || !ownerName || !ownerPhone || !ownerEmail}
              onClick={() => {
                setQuery(businessName);
                setStep("place");
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cta hover:bg-cta-hover text-white font-semibold text-sm tracking-tight transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-xs hover:shadow"
            >
              <span>Continue to Google Place</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Google Place Selection */}
      {step === "place" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-ink">Connect your Google Place</h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Find your official Google Business Profile listing.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-line bg-paper-subtle/50 px-4 py-2.5 text-sm text-ink focus:bg-white focus:border-brand transition-colors"
              placeholder="Search by business name or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
            {results.map((r) => {
              const isSelected = selectedPlace?.place_id === r.place_id;
              return (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => setSelectedPlace(r)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-brand bg-brand/5 shadow-xs ring-1 ring-brand"
                      : "border-line bg-white hover:border-brand/40 hover:bg-paper-subtle/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-ink">{r.name}</p>
                    {isSelected && (
                      <span className="text-[10px] uppercase bg-brand text-white px-2 py-0.5 rounded-full font-bold">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1">{r.address}</p>
                  {r.rating !== null && (
                    <p className="text-xs text-ink-subtle mt-1.5 flex items-center gap-1.5">
                      <span className="text-amber-500 font-bold">★ {r.rating}</span>
                      <span>({r.review_count} reviews on Google)</span>
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedPlace && (
            <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-brand font-bold">Confirmed Place</span>
                <p className="text-sm font-bold text-ink mt-0.5">{selectedPlace.name}</p>
              </div>
              <span className="text-xs text-positive font-bold">✓ Ready</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-line flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="px-4 py-2 rounded-full border border-line text-xs sm:text-sm font-medium text-ink hover:bg-paper-subtle cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!selectedPlace}
              onClick={() => setStep("placement")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-cta hover:bg-cta-hover text-white font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-xs hover:shadow"
            >
              <span>Continue to Guidelines</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: QR Placement Policy */}
      {step === "placement" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-ink">QR code placement rules</h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Google review guidelines &amp; printed material policy
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper-subtle border border-line flex flex-col gap-2.5 text-xs sm:text-sm text-ink-muted leading-relaxed">
            <p>
              <strong className="text-ink">Allowed:</strong> Counter tent cards, bill/receipt footers, window stickers, or appointment reminder cards.
            </p>
            <p>
              <strong className="text-ink">Prohibited:</strong> Company-owned tablets or kiosks handed to the customer, staff hovering over the customer while they complete it, and any discount, freebie or reward for leaving a review.
            </p>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-white hover:bg-paper-subtle cursor-pointer transition-colors mt-1">
            <input
              type="checkbox"
              checked={placementAck}
              onChange={(e) => setPlacementAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-brand cursor-pointer"
            />
            <span className="text-xs sm:text-sm text-ink leading-snug">
              I understand that the Revyu QR code must be printed material (not a business-owned tablet handed to customers), and I agree to place it respectfully.
            </span>
          </label>

          <div className="mt-4 pt-4 border-t border-line flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep("place")}
              className="px-4 py-2 rounded-full border border-line text-xs sm:text-sm font-medium text-ink hover:bg-paper-subtle cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!placementAck}
              onClick={() => setStep("plan")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-cta hover:bg-cta-hover text-white font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-xs hover:shadow"
            >
              <span>Continue to Plan</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Plan Selection */}
      {step === "plan" && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-ink">Select your plan</h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              15 days free · you authorise payment now, the first charge is after the trial
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlanOption
              selected={plan === "monthly"}
              onSelect={() => setPlan("monthly")}
              title="Monthly"
              price="₹499"
              period="/month"
              note="Pay as you go"
            />
            <PlanOption
              selected={plan === "annual"}
              onSelect={() => setPlan("annual")}
              title="Annual"
              price="₹4,499"
              period="/year"
              badge="Save 25%"
              note="About ₹375/mo"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-paper-subtle border border-line text-xs text-ink-muted leading-relaxed">
            ✓ Your 15-day trial starts when we verify your business.
            <br />
            ✓ The first charge comes after the trial. Cancel before then and you pay nothing.
            <br />
            ✓ If we can&rsquo;t verify your listing, the authorisation is cancelled (or any payment refunded in full).
          </div>

          <div className="mt-4 pt-4 border-t border-line flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep("placement")}
              className="px-4 py-2 rounded-full border border-line text-xs sm:text-sm font-medium text-ink hover:bg-paper-subtle cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-cta hover:bg-cta-hover text-white font-semibold text-xs sm:text-sm tracking-tight transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>{submitting ? "Opening payment…" : "Authorise & start free trial"}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-paper-subtle/50 px-3.5 py-2.5 text-sm text-ink focus:bg-white focus:border-brand transition-colors"
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
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative ${
        selected
          ? "border-brand bg-brand/5 shadow-xs ring-2 ring-brand/30"
          : "border-line bg-white hover:border-brand/40"
      }`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[10px] uppercase bg-cta text-white px-2 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</p>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-display text-2xl sm:text-3xl text-ink">{price}</span>
        <span className="text-xs text-ink-muted font-medium">{period}</span>
      </div>
      {note && <p className="text-xs text-brand font-semibold mt-1">{note}</p>}
    </button>
  );
}

function describeError(code: string): string {
  switch (code) {
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
