"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui";
import { logout } from "@/lib/dashboard/api";

const ITEMS = [
  { href: "/app/hub", label: "QR page", note: "Connect, services, rewards and what customers see after scanning" },
  { href: "/app/grow", label: "Grow", note: "Website, video, content and automation services" },
  { href: "/app/insights", label: "Insights", note: "Funnel, top compliments and your rating" },
  { href: "/app/competitors", label: "Competitors", note: "Follow nearby businesses and see who is gaining reviews" },
  { href: "/app/referrals", label: "Refer & save", note: "70% off when a referral subscribes" },
];

export default function MorePage() {
  const router = useRouter();
  return (
    <>
      <h1 className="font-display text-2xl text-ink">More</h1>
      <Card>
        <ul className="divide-y divide-line">
          {ITEMS.map((i) => (
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
