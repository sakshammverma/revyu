"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { OutletStatePill } from "@/components/ui";
import { logout } from "@/lib/dashboard/api";
import { useOwner } from "./OwnerContext";

const NAV = [
  { href: "/app", label: "Overview", icon: "◎" },
  { href: "/app/feedback", label: "Feedback", icon: "✉" },
  { href: "/app/insights", label: "Insights", icon: "▤" },
  { href: "/app/competitors", label: "Competitors", icon: "⚑" },
  { href: "/app/qr", label: "QR & Print", icon: "▦" },
  { href: "/app/hub", label: "QR page", icon: "▣" },
  { href: "/app/grow", label: "Grow", icon: "↗" },
  { href: "/app/referrals", label: "Refer & save", icon: "✦" },
  { href: "/app/billing", label: "Billing", icon: "₹" },
];

// Mobile bottom bar shows the four daily destinations; the rest live under "More".
const MOBILE_PRIMARY = ["/app", "/app/feedback", "/app/qr", "/app/billing"];
const MORE_PATHS = ["/app/more", "/app/competitors", "/app/insights", "/app/referrals", "/app/hub", "/app/grow"];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { outlet } = useOwner();

  async function handleLogout() {
    await logout().catch(() => {});
    router.replace("/app/login");
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sheet border-r border-line sticky top-0 h-screen">
        <Link href="/" className="px-5 h-16 flex items-center font-bold text-xl tracking-tight text-ink">
          Revyu
        </Link>
        <nav aria-label="Main" className="flex-1 px-3 py-2 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 min-h-[44px] rounded-[var(--r-control)] text-sm font-semibold transition-colors ${
                  active ? "bg-accent-50 text-accent-hover" : "text-text-2 hover:bg-paper-subtle hover:text-ink"
                }`}
              >
                <span aria-hidden className="w-5 text-center">
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line flex flex-col gap-1">
          <a
            href="mailto:support@revyu.in"
            className="px-3 min-h-[40px] flex items-center rounded-[var(--r-control)] text-sm text-text-2 hover:bg-paper-subtle"
          >
            Help
          </a>
          <button
            onClick={handleLogout}
            className="px-3 min-h-[40px] flex items-center rounded-[var(--r-control)] text-sm text-text-2 hover:bg-paper-subtle text-left cursor-pointer"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-sheet/90 backdrop-blur-xl border-b border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="lg:hidden font-bold text-lg tracking-tight text-ink">
                Revyu
              </Link>
              <span className="lg:hidden text-line-strong">/</span>
              <span className="text-sm font-semibold text-ink truncate">{outlet.business_name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <OutletStatePill state={outlet.state} />
              <button
                onClick={handleLogout}
                className="lg:hidden text-sm text-text-2 font-semibold min-h-[44px] px-1 cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-28 lg:pb-10 flex flex-col gap-4 sm:gap-5">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-sheet border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
      >
        {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold ${
                active ? "text-accent-hover" : "text-text-2"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {n.icon}
              </span>
              {n.label}
            </Link>
          );
        })}
        <Link
          href="/app/more"
          aria-current={MORE_PATHS.some((p) => pathname.startsWith(p)) ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold ${
            MORE_PATHS.some((p) => pathname.startsWith(p)) ? "text-accent-hover" : "text-text-2"
          }`}
        >
          <span aria-hidden className="text-lg leading-none">
            ⋯
          </span>
          More
        </Link>
      </nav>
    </div>
  );
}
