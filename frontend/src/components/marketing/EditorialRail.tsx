import Image from "next/image";
import Link from "next/link";
import { Price } from "@/lib/pricing";

// Three short explainers that link to real pages on this site.
// Images are decorative.
const ARTICLES = [
  {
    title: "See exactly how far ahead they are",
    category: "Free report",
    readTime: "Your numbers, not ours",
    image: "/images/street-mumbai-shops.jpg",
    href: "/gap-report",
    summary:
      "Look up your shop and the ones around you. Your rating, theirs, and the count a stranger reads before anything else.",
  },
  {
    title: "A scan, a few taps, a review on Google",
    category: "How it works",
    readTime: "Three steps",
    image: "/images/street-kirana-row.jpg",
    href: "/how-it-works",
    summary:
      "Nothing for your customer to install or learn. Nothing for you to remember once it is printed.",
  },
  {
    title: (
      <>
        <Price plan="monthly" /> a month. Less than one regular.
      </>
    ),
    category: "Pricing",
    readTime: "One flat price",
    image: "/images/portrait-shopkeeper.jpg",
    href: "/pricing",
    summary:
      "What one loyal customer spends with you in a year is more than this. What not asking costs you never shows up on a bill.",
  },
];

export function EditorialRail() {
  return (
    <section className="max-w-[1296px] mx-auto px-4 sm:px-8 py-16 sm:py-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
        <div>
          <p className="vf-section-label uppercase tracking-wider mb-2 text-text-2">
            Before the shop next door does
          </p>
          <h2 className="heading-h2 font-display text-ink">
            Three places to start.
          </h2>
        </div>
        <Link
          href="/how-it-works"
          className="text-sm font-semibold text-accent hover:text-accent flex items-center gap-1 group self-start sm:self-end"
        >
          <span>How it works</span>
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* 3 Post Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {ARTICLES.map((article, idx) => (
          <Link
            key={idx}
            href={article.href}
            className="v2-post-card flex flex-col justify-between border border-line cursor-pointer group"
          >
            <div>
              {/* Media inset */}
              <div className="relative aspect-[16/10] rounded-[10px] overflow-hidden mb-4 border border-line">
                <Image
                  src={article.image}
                  alt=""
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded text-[11px] font-semibold text-ink">
                  {article.category}
                </div>
              </div>

              {/* Title & Description */}
              <p className="text-xs text-text-muted mb-1.5">{article.readTime}</p>
              <h3 className="font-display text-lg sm:text-xl text-ink leading-snug group-hover:text-accent transition-colors">
                {article.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-3">
                {article.summary}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-line flex items-center text-xs font-semibold text-accent">
              <span>Read more</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
