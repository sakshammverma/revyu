import Image from "next/image";
import Link from "next/link";

const SEALS = [
  {
    code: "CR-01",
    title: "Runtime Assembly",
    copy: "Reviews are assembled live at checkout based strictly on customer tag choices. The customer remains the sole author.",
  },
  {
    code: "CR-02",
    title: "Official Google Deep-Link",
    copy: "We hand customers straight to Google's authentic review interface. Zero scraping, zero proxy servers, zero API spoofing.",
  },
  {
    code: "CR-03",
    title: "Zero Sentiment Gating",
    copy: "We never hide the Google link or divert dissatisfied visitors to a private inbox. Every customer gets full Google access.",
  },
  {
    code: "CR-04",
    title: "Zero Incentives & Bribes",
    copy: "Strict compliance with FTC and Google terms. No discounts, contest entries, or gifts in exchange for reviews.",
  },
];

export function DarkInfrastructure() {
  return (
    <div className="mx-2 sm:mx-3 my-12 sm:my-16">
      <section className="rounded-2xl bg-[#1f2429] text-white p-6 sm:p-12 lg:p-16 border border-[#2b3239] overflow-hidden">
        {/* Header Block */}
        <div className="max-w-3xl mb-12">
          <p className="vf-section-label-dark uppercase tracking-wider mb-2 text-[#9aa1a3]">
            Google Merchant Compliance
          </p>
          <h2 className="heading-h2 font-display text-white">
            Built from day one to protect your Google listing from penalties.
          </h2>
          <p className="mt-4 text-base text-[#9aa1a3] leading-relaxed">
            Most review automation tools secretly break Google&rsquo;s guidelines by sentiment-gating unhappy customers. When Google detects this, they wipe reviews and suspend Business Profiles. Revyu does things the honest, enduring way.
          </p>
        </div>

        {/* Arc Lines SVG Strip (Top) */}
        <div className="w-full h-12 relative overflow-hidden opacity-30 my-4">
          <Image
            src="/assets/arc-lines-dark.svg"
            alt="Arc lines decorative pattern"
            fill
            className="object-cover"
          />
        </div>

        {/* 3 Large Dark Stats */}
        <div className="py-8 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2b3239] text-center border-y border-[#2b3239]">
          <div className="py-6 sm:py-0 px-4">
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight">
              0
            </p>
            <p className="text-sm font-medium text-[#e2e4e5] mt-2">
              Reviews gated or hidden
            </p>
            <p className="text-xs text-[#9aa1a3] mt-0.5">
              100% compliant with Google CR-3
            </p>
          </div>

          <div className="py-6 sm:py-0 px-4">
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#397dff] tracking-tight">
              100%
            </p>
            <p className="text-sm font-medium text-[#e2e4e5] mt-2">
              Direct customer authorship
            </p>
            <p className="text-xs text-[#9aa1a3] mt-0.5">
              Customer submits via personal Google account
            </p>
          </div>

          <div className="py-6 sm:py-0 px-4">
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight">
              ₹499
            </p>
            <p className="text-sm font-medium text-[#e2e4e5] mt-2">
              Flat monthly rate
            </p>
            <p className="text-xs text-[#9aa1a3] mt-0.5">
              No hidden fees, no tiered feature locks
            </p>
          </div>
        </div>

        {/* Arc Lines SVG Strip (Bottom) */}
        <div className="w-full h-12 relative overflow-hidden opacity-30 my-4">
          <Image
            src="/assets/arc-lines-dark.svg"
            alt="Arc lines decorative pattern"
            fill
            className="object-cover"
          />
        </div>

        {/* 4 Compliance Seals Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SEALS.map((seal) => (
            <div
              key={seal.code}
              className="p-5 rounded-xl bg-[#262c32] border border-[#2b3239] flex flex-col justify-between"
            >
              <div>
                {/* 56px circular dark seal */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#38414a] to-[#1f2429] border border-[#38414a] flex items-center justify-center font-mono text-xs font-bold text-[#397dff] mb-4 shadow-sm">
                  {seal.code}
                </div>
                <h4 className="text-base font-semibold text-white mb-2">
                  {seal.title}
                </h4>
                <p className="text-xs text-[#9aa1a3] leading-relaxed">
                  {seal.copy}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Action */}
        <div className="mt-12 pt-8 border-t border-[#2b3239] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#9aa1a3]">
            Want to learn more about how Google enforces merchant review policies?
          </p>
          <Link
            href="/compliance"
            className="btn-pill-light text-xs font-semibold px-4 py-2"
          >
            <span>Read the complete 5 Rules documentation</span>
            <span className="font-bold">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
