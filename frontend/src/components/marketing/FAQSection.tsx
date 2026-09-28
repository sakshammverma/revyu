"use client";

import { useState } from "react";
import Link from "next/link";

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
    a: "Anywhere printed. We email your QR and four print-ready files: a receipt footer, a handout card, an A5 counter standee and a counter sticker. Print them locally, or have a ready kit delivered to your shop for \u20B9199.",
  },
  {
    q: "What does it cost?",
    a: "15 days free, then 10 more credits, then \u20B9499 a month or \u20B94,499 a year. One price for every kind of business. Less than one regular customer brings you in a year.",
  },
  {
    q: "Will this fix my rating overnight?",
    a: "No, and be wary of anyone who says it will. What it changes is simple: every customer gets asked, the same easy way, starting today, and your dashboard shows you honestly what happens.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggleFAQ(idx: number) {
    setOpenIndex(openIndex === idx ? null : idx);
  }

  return (
    <div id="faq" className="mx-2 sm:mx-3 my-16 sm:my-24">
      <section className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            Questions
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            What owners say before they start.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#6e797b] leading-relaxed">
            Short answers. The longer you wait, the less they matter.
          </p>
        </div>

        {/* Accordion List */}
        <div className="max-w-4xl divide-y divide-[#e8ecec] border-y border-[#e8ecec]">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="py-5 sm:py-6">
                <button
                  type="button"
                  onClick={() => toggleFAQ(idx)}
                  className="w-full flex items-center justify-between gap-4 text-left group cursor-pointer"
                >
                  <span className="font-display text-lg sm:text-xl text-[#1a1e23] group-hover:text-[#397dff] transition-colors">
                    {faq.q}
                  </span>
                  <span
                    className={`w-7 h-7 rounded-full bg-[#f2f7f7] border border-[#e8ecec] flex items-center justify-center text-sm font-semibold text-[#1a1e23] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-45 bg-[#397dff] text-white border-[#397dff]" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-4 text-sm sm:text-base text-[#515a63] leading-relaxed pr-8 animate-[chatBubbleIn_0.25s_ease]">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Help Note */}
        <div className="mt-10 flex items-center gap-3 text-xs text-[#515a63]">
          <span>Something we haven’t answered?</span>
          <Link
            href="/contact"
            className="font-semibold text-[#397dff] hover:text-[#2f68db] underline"
          >
            Contact us →
          </Link>
        </div>
      </section>
    </div>
  );
}
