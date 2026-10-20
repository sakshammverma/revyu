import Link from "next/link";
import { Price } from "@/lib/pricing";

const FAQS = [
  {
    q: "I\u2019ll do this next month.",
    a: "Everyone does, and that is the whole problem. Nobody decides to fall behind; they decide to do it later. Meanwhile every customer who leaves happy and unasked is one more the shop next door can still collect. Printing a code takes one afternoon. Catching up takes far longer.",
  },
  {
    q: "My customers already love me. Don\u2019t I have enough?",
    a: "Love is invisible to a stranger. The person choosing between you and the shop down the road has never met you, so they read the count. Your regulars already know. It\u2019s the people who haven\u2019t walked in yet that the number is for.",
  },
  {
    q: "Do my customers need an app or an account?",
    a: "No. They scan the printed code with their phone camera and it opens in the browser. Nothing to install, nothing to sign up for.",
  },
  {
    q: "What if I forget, or I\u2019m too busy?",
    a: "That is exactly why it exists. You print it once. After that it asks every customer, every day, whether you remember, are busy, tired or on holiday.",
  },
  {
    q: "Where do I put the code?",
    a: "Anywhere printed. We email your QR and four print-ready files: a receipt footer, a handout card, an A5 counter standee and a counter sticker. Print them locally, or, in India, have a ready kit delivered to your shop for \u20B9199.",
  },
  {
    q: "What does it cost?",
    a: (
      <>
        <Price plan="monthly" /> a month or <Price plan="annual" /> a year, one price for every kind of business. The first 15 days are free: you set up autopay at signup, the first charge comes after the trial, and if you cancel before then you pay nothing.
      </>
    ),
  },
  {
    q: "Will this fix my rating overnight?",
    a: "No, and be wary of anyone who says it will. What it changes is simple: every customer gets asked, the same easy way, starting today, and your dashboard shows you honestly what happens.",
  },
];

export function FAQSection() {
  return (
    <div id="faq" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-line p-6 sm:p-12 lg:p-16">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-text-2">
            Questions
          </p>
          <h2 className="heading-h2 font-display text-ink">
            What owners say before they start.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-text-muted leading-relaxed">
            Short answers. The longer you wait, the less they matter.
          </p>
        </div>

        {/* Accordion: native <details name="faq"> (one open at a time). Every answer is in the HTML,
            so search engines and find-in-page see them, and no client JS is needed. */}
        <div className="max-w-4xl divide-y divide-line border-y border-line">
          {FAQS.map((faq, idx) => (
            <details key={idx} name="faq" open={idx === 0} className="group py-5 sm:py-6">
              <summary className="list-none [&::-webkit-details-marker]:hidden w-full flex items-center justify-between gap-4 text-left cursor-pointer">
                <h3 className="font-display text-lg sm:text-xl text-ink group-hover:text-accent transition-colors">{faq.q}</h3>
                <span
                  aria-hidden
                  className="w-7 h-7 rounded-full bg-bg border border-line flex items-center justify-center text-sm font-semibold text-ink shrink-0 transition-transform duration-200 group-open:rotate-45 group-open:bg-accent group-open:text-white group-open:border-accent"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm sm:text-base text-text-2 leading-relaxed pr-8">{faq.a}</p>
            </details>
          ))}
        </div>

        {/* Bottom Help Note */}
        <div className="mt-10 flex items-center gap-3 text-xs text-text-2">
          <span>Something we haven’t answered?</span>
          <Link
            href="/contact"
            className="font-semibold text-accent-hover hover:text-accent underline"
          >
            Contact us →
          </Link>
        </div>
      </section>
    </div>
  );
}
