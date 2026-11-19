import Link from "next/link";

import { EmailCapture } from "@/components/marketing/EmailCapture";
import { Logo } from "@/components/ui/Logo";
import { Price } from "@/lib/pricing";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/demo", label: "Try the demo" },
      { href: "/pricing", label: "Pricing" },
      { href: "/gap-report", label: "Free gap report" },
      { href: "/compliance", label: "Our five rules" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Start 15-day trial" },
      { href: "/app", label: "Owner login" },
      { href: "/contact", label: "Contact and support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/refund-policy", label: "Refund Policy" },
      { href: "/credits", label: "Photo Credits" },
    ],
  },
];

export function Footer() {
  return (
    <div className="mx-2 sm:mx-3 mb-3 mt-3">
      <footer className="night-surface overflow-hidden rounded-2xl p-8 sm:p-12 lg:p-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-12 border-b border-white/10">
          <div className="lg:col-span-6 max-w-lg">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <Logo className="text-2xl text-white" markClassName="w-7 h-7 transition-transform group-hover:scale-105" />
            </Link>
            <p className="heading-h3 text-white!">A printed QR that helps your customers write their own Google reviews.</p>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">For any local shop or business. No app, no gating, no incentives.</p>

            <EmailCapture tone="dark" cta="Start trial" className="mt-7 max-w-[400px]" />
            <p className="text-xs text-white/70 mt-2">
              15 days free · then <Price plan="monthly" suffix="/month flat" fallback="one flat monthly price" /> · cancel anytime
            </p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-4">{col.title}</p>
                <ul className="flex flex-col gap-3 text-sm text-white/85">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="hover:text-white hover:underline transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span aria-hidden className="w-2 h-2 rounded-full bg-[#5fd068]" />
            <span>Google link shown at every rating · no incentives, ever</span>
          </div>
          <p>© {new Date().getFullYear()} Revyu. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
