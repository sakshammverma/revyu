"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

import { Icon } from "@/components/hub/Icons";
import { Logo } from "@/components/ui/Logo";
import { clearAdminToken, fetchAdminQueue, getAdminToken, subscribeAdminToken, type AdminQueue } from "@/lib/admin/api";
import { useAsync } from "@/lib/useAsync";

type NavItem = { href: string; label: string; icon: string; badge?: keyof AdminQueue };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Monitor",
    items: [
      { href: "/admin/customers", label: "Customers", icon: "home" },
      { href: "/admin/metrics", label: "Kill metric", icon: "chart" },
    ],
  },
  {
    title: "To do",
    items: [
      { href: "/admin/approvals", label: "Approvals", icon: "check", badge: "approvals" },
      { href: "/admin/pending-sends", label: "WhatsApp queue", icon: "whatsapp", badge: "pending_sends" },
    ],
  },
  {
    title: "Setup",
    items: [
      { href: "/admin/outlets", label: "Add outlets", icon: "qr" },
      { href: "/admin/services", label: "Services", icon: "gem" },
      { href: "/admin/referrals", label: "Referrals", icon: "gift" },
      { href: "/admin/pricing", label: "Pricing", icon: "card" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  // "Add outlets" owns /admin/outlets exactly; its sub-pages (QR setup) belong to a customer.
  if (href === "/admin/outlets") return pathname === href;
  if (href === "/admin/customers" && pathname.startsWith("/admin/outlets/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={`ml-auto min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums inline-flex items-center justify-center ${
        active ? "bg-accent text-white" : "bg-alert text-white"
      }`}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const token = useSyncExternalStore(subscribeAdminToken, getAdminToken, () => null);
  // Refreshes on every navigation, so clearing a queue updates its badge.
  const { data: queue } = useAsync(() => (token ? fetchAdminQueue() : Promise.resolve(null)), [token, pathname]);

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-sheet focus:text-ink focus:px-4 focus:py-2 focus:rounded-[var(--r-control)] focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sheet border-r border-line sticky top-0 h-screen">
        <Link href="/admin/customers" className="px-5 h-16 flex items-center gap-2 text-ink">
          <Logo label="Revyu Admin" className="text-lg" markClassName="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-hover bg-accent-50 rounded px-1.5 py-0.5">Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex-1 px-3 py-2 flex flex-col gap-5 overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{g.title}</p>
              {g.items.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 min-h-[42px] rounded-[var(--r-control)] text-sm font-semibold transition-colors ${
                      active ? "bg-accent-50 text-accent-hover" : "text-text-2 hover:bg-paper-subtle hover:text-ink"
                    }`}
                  >
                    <Icon name={n.icon} className="w-[18px] h-[18px] shrink-0" />
                    {n.label}
                    {n.badge && <Badge n={queue?.[n.badge] ?? 0} active={active} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {token && (
          <div className="p-3 border-t border-line">
            <button
              type="button"
              onClick={clearAdminToken}
              className="w-full px-3 min-h-[40px] flex items-center rounded-[var(--r-control)] text-sm text-text-2 hover:bg-paper-subtle hover:text-ink cursor-pointer"
            >
              Lock admin
            </button>
          </div>
        )}
      </aside>

      {/* Phone / tablet: one scrollable row of every section */}
      <header className="lg:hidden sticky top-0 z-30 bg-sheet/95 backdrop-blur-xl border-b border-line">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/admin/customers" className="flex items-center gap-2 text-ink">
            <Logo label="Revyu Admin" className="text-base" markClassName="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-hover bg-accent-50 rounded px-1.5 py-0.5">Admin</span>
          </Link>
          {token && (
            <button type="button" onClick={clearAdminToken} className="text-sm font-semibold text-text-2 min-h-[44px] px-2 cursor-pointer">
              Lock
            </button>
          )}
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {ALL.map((n) => {
            const active = isActive(pathname, n.href);
            const count = n.badge ? (queue?.[n.badge] ?? 0) : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full text-[13px] font-semibold ${
                  active ? "bg-ink text-white" : "bg-paper-subtle text-text-2"
                }`}
              >
                {n.label}
                {count > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-alert text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <div id="admin-main" tabIndex={-1} className="flex-1 min-w-0 flex flex-col outline-none">
        {children}
      </div>
    </div>
  );
}
