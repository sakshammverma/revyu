import Link from "next/link";

const LINKS = [
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/pending-sends", label: "Pending sends" },
  { href: "/admin/outlets", label: "Outlets" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/referrals", label: "Referrals" },
];

// Shared admin chrome. Founder-only; every page still carries its own token gate.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <nav aria-label="Admin" className="bg-sheet border-b border-line">
        <div className="max-w-5xl mx-auto px-3 sm:px-8 h-14 flex items-center gap-1 overflow-x-auto">
          <span className="font-bold text-ink mr-3 shrink-0">Revyu Admin</span>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 min-h-[44px] inline-flex items-center rounded-[var(--r-control)] text-sm font-semibold text-text-2 hover:bg-paper-subtle hover:text-ink shrink-0"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
