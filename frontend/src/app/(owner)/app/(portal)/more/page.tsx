"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { MOBILE_PRIMARY, NAV } from "@/components/portal/nav";
import { Card } from "@/components/ui";
import { logout } from "@/lib/dashboard/api";

export default function MorePage() {
  const router = useRouter();
  const items = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  return (
    <>
      <h1 className="font-display text-2xl text-ink">More</h1>
      <Card>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="flex items-center justify-between min-h-[56px] py-2">
                <span>
                  <span className="block font-semibold text-ink">{i.label}</span>
                  <span className="block text-sm text-text-2">{i.note}</span>
                </span>
                <span aria-hidden className="text-text-muted">›</span>
              </Link>
            </li>
          ))}
          <li>
            <a href="mailto:support@revyu.in" className="flex items-center min-h-[56px] font-semibold text-ink">
              Help &amp; support
            </a>
          </li>
          <li>
            <button
              onClick={async () => {
                if (!window.confirm("Log out of Revyu?")) return;
                await logout().catch(() => {});
                router.replace("/app/login");
              }}
              className="flex items-center w-full min-h-[56px] font-semibold text-alert cursor-pointer"
            >
              Log out
            </button>
          </li>
        </ul>
      </Card>
    </>
  );
}
