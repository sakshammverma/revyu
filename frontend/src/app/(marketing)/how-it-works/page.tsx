import type { Metadata } from "next";
import { demoQr } from "@/lib/marketing/qr";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { MarketingPage } from "@/components/chrome/MarketingPage";
import { FlowStory } from "@/components/marketing/FlowStory";
import { JourneyMap } from "@/components/marketing/JourneyMap";
import { PageHero } from "@/components/marketing/PageHero";
import { Reveal } from "@/components/marketing/Reveal";
import { PlaygroundProvider } from "@/components/marketing/interact";

export const metadata: Metadata = pageMetadata({
  path: "/how-it-works",
  title: "How it works — Revyu",
  description:
    "Three steps: scan, tap, paste. No app, no review gating, no pre-written reviews.",
});

const SUMMARY = [
  { n: "01", title: "Scan", body: "The printed QR on a receipt, card, sticker or counter standee. No app, no login." },
  { n: "02", title: "Tap", body: "A star rating, then whatever stood out. As many tags as apply, or none at all." },
  { n: "03", title: "Paste", body: "An editable draft built from their taps. They copy it and post it on Google themselves." },
];

export default function HowItWorksPage() {
  return (
    <PlaygroundProvider>
      <MarketingPage>
        <PageHero
          eyebrow="How it works"
          title="Three steps. Nothing hidden."
          lead="What your customer does, start to finish, including the one step we can’t remove."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/demo" className="btn-primary min-h-[48px] px-6 text-[15px]">
              <span>Try it as a customer</span>
              <span aria-hidden>→</span>
            </Link>
            <Link href="/signup" className="btn-ghost-dark">
              Start free trial
            </Link>
          </div>
        </PageHero>

        {/* The three steps at a glance */}
        <section aria-label="The three steps" className="mx-auto max-w-[1296px] px-4 pt-10 sm:px-8 sm:pt-14">
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {SUMMARY.map((s, i) => (
              <Reveal key={s.n} order={i}>
                <div className="lift h-full rounded-2xl border border-line bg-white p-6 shadow-v2-rest sm:p-7">
                  <span className="font-display text-4xl text-accent">{s.n}</span>
                  <h2 className="mt-2 font-display text-2xl text-ink">{s.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-2">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The same steps, on the real screens */}
        <FlowStory qr={demoQr()} />

        {/* What happens at each rating */}
        <JourneyMap />

        {/* About the paste step */}
        <section className="mx-2 mt-10 sm:mx-3 sm:mt-16">
          <Reveal>
            <div className="mx-auto grid max-w-[1296px] gap-8 rounded-2xl border border-line bg-white p-6 shadow-v2-rest sm:p-12 lg:grid-cols-[1fr_1.4fr] lg:gap-14 lg:p-16">
              <div>
                <p className="vf-section-label mb-2 uppercase tracking-wider">The honest part</p>
                <h2 className="heading-h2">About that paste step</h2>
              </div>
              <div className="flex flex-col gap-4 text-base leading-relaxed text-text-2">
                <p>
                  Google&rsquo;s review form accepts no pre-filled rating and no pre-filled text. There is no legitimate
                  workaround, and we don&rsquo;t pretend otherwise. After copying, the customer is handed to Google and posts
                  from their own account.
                </p>
                <p>
                  Any tool that claims to submit reviews for your customers is either scraping Google or breaking its terms,
                  and the risk lands on your listing. We keep the paste step because it is the honest version of this product:
                  your customer is the author.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-6">
                  <Link href="/signup" className="btn-primary min-h-[48px] px-6 text-[15px]">
                    <span>Start free trial</span>
                    <span aria-hidden>→</span>
                  </Link>
                  <Link href="/compliance" className="text-sm font-semibold text-accent-hover underline underline-offset-4 hover:no-underline">
                    Read the five rules we follow
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </MarketingPage>
    </PlaygroundProvider>
  );
}
