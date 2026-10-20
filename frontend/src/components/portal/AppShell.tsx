"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/hub/Icons";
import { OutletStatePill } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/dashboard/api";
import { useOwner } from "./OwnerContext";
import { isActive, MOBILE_PRIMARY, NAV } from "./nav";

const GROUPS = ["Daily", "Setup", "Grow", "Account"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { outlet } = useOwner();
  const current = NAV.find((n) => isActive(pathname, n.href));
  const moreActive = pathname.startsWith("/app/more") || NAV.some((n) => !MOBILE_PRIMARY.includes(n.href) && isActive(pathname, n.href));

  async function handleLogout() {
    await logout().catch(() => {});
    router.replace("/app/login");
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* React 19 hoists this into <head>; it also gives the route announcer something useful to read. */}
      <title>{current ? `${current.label} — Revyu` : "Dashboard — Revyu"}</title>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-sheet focus:text-ink focus:px-4 focus:py-2 focus:rounded-[var(--r-control)] focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sheet border-r border-line sticky top-0 h-screen">
        <Link href="/app" aria-label="Revyu dashboard" className="px-5 h-16 flex items-center text-ink">
          <Logo className="text-xl" markClassName="w-6 h-6" />
        </Link>
        <nav aria-label="Main" className="flex-1 px-3 py-2 flex flex-col gap-4 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{group}</p>
              {NAV.filter((n) => n.group === group).map((n) => {
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
                    <Icon name={n.icon} className="w-5 h-5 shrink-0" />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
              <Link href="/app" aria-label="Revyu dashboard" className="lg:hidden text-ink shrink-0">
                <Logo className="text-lg" markClassName="w-6 h-6" />
              </Link>
              <span aria-hidden className="lg:hidden text-line-strong">/</span>
              <span className="text-sm font-semibold text-ink truncate">{outlet.business_name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <OutletStatePill state={outlet.state} />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-28 lg:pb-10 flex flex-col gap-4 sm:gap-5 outline-none">
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
              <Icon name={n.icon} className="w-5 h-5" />
              {n.tabLabel ?? n.label}
            </Link>
          );
        })}
        <Link
          href="/app/more"
          aria-current={moreActive ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold ${
            moreActive ? "text-accent-hover" : "text-text-2"
          }`}
        >
          <Icon name="more" className="w-5 h-5" />
          More
        </Link>
      </nav>
    </div>
  );
}
