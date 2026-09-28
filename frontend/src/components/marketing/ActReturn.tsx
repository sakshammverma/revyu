import Link from "next/link";

export function ActReturn() {
  return (
    <section className="w-full max-w-6xl mx-auto border-x border-b border-line bg-paper">
      {/* Section Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-5 border-b border-line gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <span className="font-bold text-brand">[ 03 DASHBOARD ]</span>
          <span className="font-semibold uppercase tracking-wider text-ink">
            Real-time insight from day one
          </span>
        </div>
        <p className="text-xs font-mono text-ink-muted uppercase">
          Live telemetry · 30-day rolling window
        </p>
      </div>

      {/* Main Instrument Panel */}
      <div className="bg-white">
        {/* Top Info Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-8 py-4 border-b border-line gap-3 bg-paper-card">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-base text-ink">Sharma General Store</span>
            <span className="font-mono text-xs px-2 py-0.5 border border-line text-ink-muted bg-paper-subtle uppercase">
              Outlet #104
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-positive uppercase">
            <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
            <span>Live telemetry active</span>
          </div>
        </div>

        {/* 3 Rectangular Metric Tiles separated by borders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line border-b border-line">
          <div className="p-6 sm:p-8 bg-white hover:bg-paper-subtle/30 transition-colors">
            <p className="font-mono text-xs uppercase font-bold text-ink-muted tracking-wider">
              [METRIC 01] Scans
            </p>
            <p className="heading text-4xl sm:text-5xl font-extrabold mt-3 text-ink">143</p>
            <p className="font-mono text-xs text-positive font-bold mt-2">↑ +24 this week</p>
          </div>

          <div className="p-6 sm:p-8 bg-white hover:bg-paper-subtle/30 transition-colors">
            <p className="font-mono text-xs uppercase font-bold text-ink-muted tracking-wider">
              [METRIC 02] Completed
            </p>
            <p className="heading text-4xl sm:text-5xl font-extrabold mt-3 text-ink">28</p>
            <p className="font-mono text-xs text-ink-muted mt-2">19.6% scan-to-draft rate</p>
          </div>

          <div className="p-6 sm:p-8 bg-white hover:bg-paper-subtle/30 transition-colors">
            <p className="font-mono text-xs uppercase font-bold text-brand tracking-wider">
              [METRIC 03] Maps Reviews
            </p>
            <p className="heading text-4xl sm:text-5xl font-extrabold mt-3 text-brand">6</p>
            <p className="font-mono text-xs text-positive font-bold mt-2">Verified published</p>
          </div>
        </div>

        {/* Trajectory & Compliments Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
          {/* Rating Trajectory */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-paper-subtle/40">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
                // Google Rating Trajectory
              </p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="heading text-3xl font-extrabold text-ink">4.3</span>
                <span className="heading text-3xl text-positive font-extrabold">→ 4.5</span>
                <span className="font-mono text-xs text-positive font-bold bg-positive/10 px-2 py-0.5 border border-positive/20">
                  +0.2 INCREASE
                </span>
              </div>
            </div>
            <p className="font-mono text-xs text-ink-muted mt-4 uppercase">
              Based on 47 → 53 published Google reviews
            </p>
          </div>

          {/* Top Compliments Frequency */}
          <div className="lg:col-span-6 p-6 sm:p-8 bg-white">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
                [TOP COMPLIMENTS // RUNTIME AGGREGATION]
              </p>
              <span className="font-mono text-xs text-ink-disabled uppercase">MENTIONS</span>
            </div>

            <div className="flex flex-col gap-3">
              <TagBar label="Friendly staff" value={52} max={60} />
              <TagBar label="On time" value={41} max={60} />
              <TagBar label="Clean space" value={35} max={60} />
            </div>
          </div>
        </div>
      </div>

      {/* Free Trial Conversion Rectangular Strip */}
      <div className="p-6 sm:p-8 border-t border-line bg-paper-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="heading text-base sm:text-lg font-bold text-ink">
            15 days free. No credit card needed.
          </h3>
          <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
            Your QR collects reviews from day one. See your real numbers before deciding anything.
          </p>
        </div>
        <Link
          href="/signup"
          className="shrink-0 px-7 py-3 bg-cta hover:bg-cta-hover text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors shadow-2xs flex items-center justify-center gap-2"
        >
          <span>Start free trial</span>
          <span className="font-bold">→</span>
        </Link>
      </div>
    </section>
  );
}

function TagBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-4">
      <p className="w-32 shrink-0 font-mono text-xs uppercase text-ink font-semibold">{label}</p>
      <div className="relative h-2 flex-1 bg-paper border border-line">
        <div
          className="absolute inset-y-0 left-0 bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="w-8 text-right font-mono text-xs text-ink-muted font-bold">{value}</p>
    </div>
  );
}
