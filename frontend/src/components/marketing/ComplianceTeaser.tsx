import Link from "next/link";

export function ComplianceTeaser() {
  return (
    <section className="w-full max-w-6xl mx-auto border-x border-b border-line bg-paper">
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-5 border-b border-line gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <span className="font-bold text-brand">[ 04 COMPLIANCE ]</span>
          <span className="font-semibold uppercase tracking-wider text-ink">
            We never hide the Google link
          </span>
        </div>
        <p className="text-xs font-mono text-ink-muted uppercase">
          100% Google Merchant Review Policy compliant
        </p>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line bg-white">
        <div className="lg:col-span-8 p-6 sm:p-10">
          <h2 className="heading text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            We never hide the Google link.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-muted leading-relaxed max-w-2xl font-normal">
            Most review tools sentiment-gate — happy customers get the Google link, while unhappy ones are diverted to a hidden private form. Google explicitly prohibits this, and enforces penalties directly against your Google Business Profile.
          </p>
          <p className="mt-3 text-xs sm:text-sm text-ink font-semibold max-w-2xl">
            Revyu was built from day one to be 100% compliant with Google&rsquo;s Merchant Review Policies.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5 font-mono text-xs uppercase">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-paper-subtle border border-line text-ink font-bold">
              <span className="text-positive">✓</span> CR-3 NO GATING
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-paper-subtle border border-line text-ink font-bold">
              <span className="text-positive">✓</span> CR-1 RUNTIME ASSEMBLY
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-paper-subtle border border-line text-ink font-bold">
              <span className="text-positive">✓</span> CR-5 ZERO INCENTIVES
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 sm:p-10 flex flex-col items-start lg:items-center justify-center bg-paper-subtle/50">
          <Link
            href="/compliance"
            className="w-full sm:w-auto px-7 py-3.5 bg-brand hover:bg-brand-hover text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors shadow-2xs flex items-center justify-center gap-2"
          >
            <span>Read the 5 rules</span>
            <span className="font-bold">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
