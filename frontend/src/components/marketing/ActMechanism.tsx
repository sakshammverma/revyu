import { PhoneDemo } from "@/components/marketing/PhoneDemo";

export function ActMechanism() {
  return (
    <section id="mechanism" className="w-full max-w-6xl mx-auto border-x border-b border-line bg-paper">
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-5 border-b border-line gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <span className="font-bold text-brand">[ 02 HOW IT WORKS ]</span>
          <span className="font-semibold uppercase tracking-wider text-ink">
            From checkout to 5-star review in 30 seconds
          </span>
        </div>
        <p className="text-xs font-mono text-ink-muted uppercase">
          Zero-barrier flow · No app install required
        </p>
      </div>

      {/* Main Grid: Steps on Left, Interactive Phone on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* Left Column: 3 Step Cards + Policy Guard */}
        <div className="lg:col-span-6 divide-y divide-line bg-white flex flex-col justify-between">
          <div className="p-6 sm:p-8 flex items-start gap-4 hover:bg-paper-subtle/40 transition-colors">
            <span className="w-8 h-8 rounded-xs bg-brand text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              01
            </span>
            <div>
              <h3 className="text-base font-bold text-ink">Instant scan at checkout</h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                Opens instantly in the customer&rsquo;s mobile browser in under 2 seconds. No app to download, no account to create, and zero friction.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex items-start gap-4 hover:bg-paper-subtle/40 transition-colors">
            <span className="w-8 h-8 rounded-xs bg-brand text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              02
            </span>
            <div>
              <h3 className="text-base font-bold text-ink">Guided tags eliminate blank-box panic</h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                Instead of staring at an intimidating blank textbox, customers tap ready-made compliment chips tailored to your kind of business.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex items-start gap-4 hover:bg-paper-subtle/40 transition-colors">
            <span className="w-8 h-8 rounded-xs bg-brand text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              03
            </span>
            <div>
              <h3 className="text-base font-bold text-ink">1-tap copy &amp; direct Google handoff</h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                The draft copies with one tap, then deep-links straight into your Google Business Profile review screen to paste and publish.
              </p>
            </div>
          </div>

          {/* Policy Transparency Callout */}
          <div className="p-6 sm:p-8 bg-paper-subtle text-xs sm:text-sm text-ink-muted leading-relaxed">
            <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold uppercase text-ink">
              <span className="text-positive">🛡️</span>
              <span>// Why the paste step keeps your listing safe</span>
            </div>
            Google strictly prohibits merchants from auto-submitting reviews on behalf of customers. The customer must hit submit themselves. Any tool claiming to bypass this risks getting your Google listing penalized or banned. Revyu keeps your business 100% compliant.
          </div>
        </div>

        {/* Right Column: Interactive Phone Demo */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col items-center justify-center bg-paper-subtle/50">
          <PhoneDemo />
        </div>
      </div>
    </section>
  );
}
