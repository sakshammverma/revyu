import type { ReactNode } from "react";

import { Icon } from "@/components/hub/Icons";
import { MOBILE_PRIMARY, NAV } from "@/components/portal/nav";
import { OutletStatePill } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";

const GROUPS = ["Daily", "Setup", "Grow", "Account"] as const;
const ACTIVE = "/app";

/**
 * The owner portal's shell (AppShell) drawn as a picture: same sidebar, header and
 * bottom tab bar, but nothing navigates (AppShell itself needs a signed-in owner).
 * Render it outside .marketing-root so headings use the portal's real font.
 *
 * The phone tab bar is drawn once at the end of the frame, not sticky or fixed: the
 * sales deck has its own bottom bar, and two stacked bars would eat a small screen.
 */
export function PortalPreview({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={`Preview of ${name}'s dashboard`}
      className="relative rounded-[var(--r-card)] border border-line bg-bg shadow-v2-elevated overflow-clip"
    >
      <p className="flex items-center justify-center gap-2 bg-accent-50 text-accent-hover border-b border-accent/20 px-3 py-1.5 text-xs font-semibold">
        <Icon name="layout" className="w-3.5 h-3.5" />
        Preview of your dashboard
      </p>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sheet border-r border-line">
          <span className="px-5 h-16 flex items-center text-ink">
            <Logo className="text-xl" markClassName="w-6 h-6" />
          </span>
          <nav aria-label="Dashboard menu, preview only" className="flex-1 px-3 py-2 flex flex-col gap-4">
            {GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{group}</p>
                {NAV.filter((n) => n.group === group).map((n) => {
                  const active = n.href === ACTIVE;
                  return (
                    <span
                      key={n.href}
                      aria-disabled="true"
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 min-h-[44px] rounded-[var(--r-control)] text-sm font-semibold ${
                        active ? "bg-accent-50 text-accent-hover" : "text-text-2"
                      }`}
                    >
                      <Icon name={n.icon} className="w-5 h-5 shrink-0" />
                      {n.label}
                    </span>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="bg-sheet/90 border-b border-line">
            <div className="px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="lg:hidden text-ink shrink-0">
                  <Logo className="text-lg" markClassName="w-6 h-6" />
                </span>
                <span aria-hidden className="lg:hidden text-line-strong">/</span>
                <span className="text-sm font-semibold text-ink truncate">{name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <OutletStatePill state="trial" />
              </div>
            </div>
          </header>

          <div className="flex-1 w-full px-3 sm:px-6 py-5 sm:py-6 flex flex-col gap-4 sm:gap-5">{children}</div>
        </div>
      </div>

      {/* Phone tab bar: static at the end of the frame (the deck's own bar is the fixed one). */}
      <nav
        aria-label="Dashboard tabs, preview only"
        className="lg:hidden bg-sheet border-t border-line grid grid-cols-5"
      >
        {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((n) => {
          const active = n.href === ACTIVE;
          return (
            <span
              key={n.href}
              aria-disabled="true"
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold ${
                active ? "text-accent-hover" : "text-text-2"
              }`}
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {n.tabLabel ?? n.label}
            </span>
          );
        })}
        <span aria-disabled="true" className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold text-text-2">
          <Icon name="more" className="w-5 h-5" />
          More
        </span>
      </nav>
    </div>
  );
}
