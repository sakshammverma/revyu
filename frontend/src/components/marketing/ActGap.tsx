export function ActGap() {
  return (
    <section className="w-full max-w-6xl mx-auto border-x border-b border-line bg-paper">
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-5 border-b border-line gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <span className="font-bold text-brand">[ 01 THE GAP ]</span>
          <span className="font-semibold uppercase tracking-wider text-ink">
            Why the business nearby gets picked first
          </span>
        </div>
        <p className="text-xs font-mono text-ink-muted uppercase">
          Local search ranking vs review velocity
        </p>
      </div>

      {/* Main 2-Column Split: Two Rectangular Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line bg-white">
        {/* Left Column: Your Business Today */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between hover:bg-paper-subtle/30 transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line text-xs font-mono uppercase">
              <span className="font-bold text-ink-muted">Your Business Today</span>
              <span className="px-2 py-0.5 border border-line text-ink-muted bg-paper-subtle">
                Passive
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2.5">
              <p className="heading text-4xl sm:text-5xl font-extrabold text-ink leading-none">47</p>
              <span className="text-xs font-mono uppercase text-ink-muted">Google Reviews</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-base font-bold text-ink">4.3</span>
              <div className="flex text-amber-500 text-xs">★★★★☆</div>
              <span className="text-[11px] font-mono uppercase text-ink-muted ml-1">Rank #8 in Area</span>
            </div>

            {/* Performance Indicators */}
            <div className="mt-6 pt-5 border-t border-line flex flex-col gap-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-ink-muted mb-1">
                  <span>Google Maps Impressions</span>
                  <span className="font-bold text-ink">380 / mo</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-line">
                  <div className="w-[20%] h-full bg-zinc-400" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-ink-muted mb-1">
                  <span>Customer Review Rate</span>
                  <span className="font-bold text-ink">0.8%</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-line">
                  <div className="w-[8%] h-full bg-zinc-400" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-ink-muted mb-1">
                  <span>Monthly Review Velocity</span>
                  <span className="font-bold text-ink">+1 review / mo</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-line">
                  <div className="w-[5%] h-full bg-zinc-400" />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 pt-4 border-t border-line text-xs sm:text-sm text-ink-muted leading-relaxed">
            You provide exceptional service, but 90% of satisfied customers walk out the door without ever thinking to open Google Maps.
          </p>
        </div>

        {/* Right Column: The Competitor Nearby */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between bg-brand/5 relative hover:bg-brand/8 transition-colors">
          <div className="absolute top-0 right-0">
            <span className="bg-brand text-white text-xs font-bold font-mono uppercase px-3 py-1">
              +133 reviews
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-brand/20 text-xs font-mono uppercase">
              <span className="font-bold text-brand">The Competitor Nearby</span>
              <span className="px-2 py-0.5 bg-brand text-white font-bold">
                Active Checkout
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-2.5">
              <p className="heading text-4xl sm:text-5xl font-extrabold text-brand leading-none">180</p>
              <span className="text-xs font-mono uppercase text-brand font-semibold">+133 advantage</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-base font-bold text-brand">4.6</span>
              <div className="flex text-amber-500 text-xs">★★★★★</div>
              <span className="text-[11px] font-mono uppercase text-positive font-bold bg-positive/10 px-2 py-0.5 border border-positive/20 ml-1">
                Top Ranked in Area
              </span>
            </div>

            {/* Performance Indicators */}
            <div className="mt-6 pt-5 border-t border-brand/20 flex flex-col gap-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-brand mb-1">
                  <span>Google Maps Impressions</span>
                  <span className="font-bold text-brand">1,940 / mo (5.1x)</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-brand/20">
                  <div className="w-[85%] h-full bg-brand" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-brand mb-1">
                  <span>Customer Review Rate</span>
                  <span className="font-bold text-brand">19.6% (24x)</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-brand/20">
                  <div className="w-[75%] h-full bg-brand" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-brand mb-1">
                  <span>Monthly Review Velocity</span>
                  <span className="font-bold text-positive">+24 reviews / mo</span>
                </div>
                <div className="w-full h-2 bg-paper-subtle border border-brand/20">
                  <div className="w-[90%] h-full bg-positive" />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 pt-4 border-t border-brand/20 text-xs sm:text-sm text-ink-muted leading-relaxed">
            They make leaving a review effortless at checkout. Every satisfied patient is handed a seamless, 30-second path to share genuine feedback.
          </p>
        </div>
      </div>

      {/* Bottom Punchline Bar */}
      <div className="p-6 sm:p-8 border-t border-line bg-paper-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="heading text-base sm:text-lg text-ink font-bold">
            Same quality care. Same prices. They just ask every customer. You don&rsquo;t.
          </h3>
          <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
            Revyu automates asking at checkout without any uncomfortable sales pressure.
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs uppercase font-bold text-brand bg-white px-5 py-2.5 border border-line shadow-2xs">
          Zero awkward talks →
        </span>
      </div>
    </section>
  );
}
