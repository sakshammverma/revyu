"use client";

import Link from "next/link";

// Three ways a shop handles it, framed by what each one costs the owner.
// No named competitors and no invented figures.
const ROWS = [
  {
    feature: "When the customer is asked",
    revyu: "At the counter, while they are still smiling",
    message: "Days later, when the feeling has gone",
    memory: "Only when you happen to remember",
    highlight: true,
  },
  {
    feature: "Who gets asked",
    revyu: "Everyone who sees the code, the quiet regulars too",
    message: "Only people whose number you hold",
    memory: "The few who come to mind",
  },
  {
    feature: "What it asks of you",
    revyu: "Print it once",
    message: "A list, a message, a follow-up. Every time",
    memory: "Your attention, every single day",
    highlight: true,
  },
  {
    feature: "Where your customer starts",
    revyu: "A draft built from their own taps",
    message: "A blank box",
    memory: "A blank box",
  },
  {
    feature: "What you see",
    revyu: "Scans, completions, what people praise",
    message: "Messages sent",
    memory: "Nothing",
  },
];

export function ComparisonMatrix() {
  return (
    <section className="mx-2 sm:mx-3 my-12 sm:my-16">
      <div className="v2-sheet max-w-[1296px] mx-auto border border-[#e8ecec] p-6 sm:p-12 lg:p-16">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-[#515a63]">
            Three ways shops do it
          </p>
          <h2 className="heading-h2 font-display text-[#1a1e23]">
            Only one of them works on the days you forget.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#59636a] leading-relaxed">
            Happy customers don&rsquo;t fail to review because they&rsquo;re unhappy. They fail because nobody asked them at the right moment.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e8ecec] bg-white shadow-v2-rest">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#e8ecec] bg-[#f8fafc]">
                <th className="p-4 sm:p-5 font-semibold text-[#1a1e23] w-1/4">&nbsp;</th>
                <th className="p-4 sm:p-5 font-bold text-[#1a1e23] bg-[#e7f5fd]/60 border-x border-[#397dff]/20 w-1/4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#397dff]" />
                    <span>A code on your counter</span>
                  </div>
                </th>
                <th className="p-4 sm:p-5 font-semibold text-[#59636a] w-1/4">A message days later</th>
                <th className="p-4 sm:p-5 font-semibold text-[#59636a] w-1/4">Asking by memory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecec]">
              {ROWS.map((row) => (
                <tr key={row.feature} className={row.highlight ? "bg-[#f8fafc]/50" : ""}>
                  <td className="p-4 sm:p-5 font-semibold text-[#1a1e23]">{row.feature}</td>
                  <td className="p-4 sm:p-5 font-bold text-[#2f68db] bg-[#e7f5fd]/40 border-x border-[#397dff]/20">
                    {row.revyu}
                  </td>
                  <td className="p-4 sm:p-5 text-[#59636a]">{row.message}</td>
                  <td className="p-4 sm:p-5 text-[#59636a]">{row.memory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-[#f8fafc] border border-[#e8ecec]">
          <p className="text-sm text-[#1a1e23] max-w-xl">
            Every customer you don&rsquo;t ask is a customer the shop next door can still win on the first thing a stranger reads.
          </p>
          <Link href="/gap-report" className="text-sm font-semibold text-[#2f68db] hover:underline shrink-0">
            See who&rsquo;s ahead of you →
          </Link>
        </div>
      </div>
    </section>
  );
}
