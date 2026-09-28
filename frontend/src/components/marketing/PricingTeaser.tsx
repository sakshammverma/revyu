import Link from "next/link";

export function PricingTeaser() {
  return (
    <section className="w-full max-w-6xl mx-auto border-x border-b border-line bg-paper">
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-5 border-b border-line gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <span className="font-bold text-brand">[ 05 PRICING ]</span>
          <span className="font-semibold uppercase tracking-wider text-ink">
            One simple price. No tiers.
          </span>
        </div>
        <p className="text-xs font-mono text-ink-muted uppercase">
          15-day free trial · All verticals included
        </p>
      </div>

      {/* 2-Column Rectangular Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line bg-white">
        {/* Monthly Card */}
        <div className="p-6 sm:p-10 flex flex-col justify-between hover:bg-paper-subtle/30 transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3 text-xs font-mono uppercase">
              <span className="font-bold text-ink-muted">[PLAN // 01] Monthly</span>
              <span className="px-2 py-0.5 border border-line text-ink-muted bg-paper-subtle">
                Cancel Anytime
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="heading text-4xl sm:text-5xl font-extrabold text-ink">₹499</span>
              <span className="font-mono text-xs uppercase text-ink-muted">/month</span>
            </div>
            <p className="text-xs sm:text-sm text-ink-muted mt-2">
              Flat, all verticals. No hidden fees or tiered feature gates.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 font-mono text-xs text-ink">
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> 15-day free trial included
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> Unlimited QR customer reviews
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> Live owner telemetry portal
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> Print-ready QR tent card templates
              </li>
            </ul>
          </div>
          <div className="mt-8 pt-6 border-t border-line">
            <Link
              href="/signup"
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-white hover:bg-paper-subtle text-ink border border-line font-mono text-xs uppercase font-bold tracking-wider transition-colors"
            >
              <span>Start free trial</span>
              <span className="font-bold">→</span>
            </Link>
          </div>
        </div>

        {/* Annual Card */}
        <div className="p-6 sm:p-10 flex flex-col justify-between bg-cta/5 relative hover:bg-cta/8 transition-colors">
          <div className="absolute top-0 right-0">
            <span className="bg-cta text-white font-mono text-xs uppercase px-3 py-1 font-bold">
              Save 25%
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between border-b border-cta/30 pb-3 text-xs font-mono uppercase">
              <span className="font-bold text-cta">[PLAN // 02] Annual</span>
              <span className="px-2 py-0.5 bg-cta text-white font-bold">
                Best Value
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="heading text-4xl sm:text-5xl font-extrabold text-ink">₹4,499</span>
              <span className="font-mono text-xs uppercase text-ink-muted">/year</span>
            </div>
            <p className="text-xs sm:text-sm text-ink-muted mt-2">
              Effective ₹374/month — save ₹1,489 compared to monthly.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 font-mono text-xs text-ink">
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> 15-day free trial included
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> Priority outlet business verification
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> High-res vector counter tent templates
              </li>
              <li className="flex items-center gap-2">
                <span className="text-positive font-bold">✓</span> Staff review attribution tracking
              </li>
            </ul>
          </div>
          <div className="mt-8 pt-6 border-t border-cta/30">
            <Link
              href="/signup"
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-cta hover:bg-cta-hover text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors shadow-2xs"
            >
              <span>Start 15-day free trial</span>
              <span className="font-bold">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Guarantee Strip */}
      <div className="p-4 border-t border-line bg-paper-subtle text-center font-mono text-xs text-ink-muted uppercase">
        // No credit card required upfront · Full access to all features during 15-day trial
      </div>
    </section>
  );
}
