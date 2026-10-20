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
      <div className="v2-sheet max-w-[1296px] mx-auto border border-line p-6 sm:p-12 lg:p-16">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <p className="vf-section-label uppercase tracking-wider mb-2 text-text-2">
            Three ways shops do it
          </p>
          <h2 className="heading-h2 font-display text-ink">
            Only one of them works on the days you forget.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-text-2 leading-relaxed">
            Happy customers don&rsquo;t fail to review because they&rsquo;re unhappy. They fail because nobody asked them at the right moment.
          </p>
        </div>

        <div role="region" aria-label="Comparison table" tabIndex={0} className="overflow-x-auto rounded-2xl border border-line bg-white shadow-v2-rest">
          <table className="w-full min-w-[640px] text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line bg-[#f8fafc]">
                <th scope="col" className="p-4 sm:p-5 font-semibold text-ink w-1/4"><span className="sr-only">Feature</span></th>
                <th scope="col" className="p-4 sm:p-5 font-bold text-ink bg-accent-50/60 border-x border-accent/20 w-1/4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span>A code on your counter</span>
                  </div>
                </th>
                <th scope="col" className="p-4 sm:p-5 font-semibold text-text-2 w-1/4">A message days later</th>
                <th scope="col" className="p-4 sm:p-5 font-semibold text-text-2 w-1/4">Asking by memory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((row) => (
                <tr key={row.feature} className={row.highlight ? "bg-[#f8fafc]/50" : ""}>
                  <th scope="row" className="p-4 sm:p-5 font-semibold text-ink">{row.feature}</th>
                  <td className="p-4 sm:p-5 font-bold text-accent-hover bg-accent-50/40 border-x border-accent/20">
                    {row.revyu}
                  </td>
                  <td className="p-4 sm:p-5 text-text-2">{row.message}</td>
                  <td className="p-4 sm:p-5 text-text-2">{row.memory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-[#f8fafc] border border-line">
          <p className="text-sm text-ink max-w-xl">
            Every customer you don&rsquo;t ask is a customer the shop next door can still win on the first thing a stranger reads.
          </p>
          <Link href="/gap-report" className="text-sm font-semibold text-accent-hover hover:underline shrink-0">
            See who&rsquo;s ahead of you →
          </Link>
        </div>
      </div>
    </section>
  );
}
