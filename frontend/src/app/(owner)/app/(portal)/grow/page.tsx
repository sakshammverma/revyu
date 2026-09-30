"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { growthApi, type Service, type ServiceRequest } from "@/lib/hub/api";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  quoted: "Quote ready",
  accepted: "Accepted",
  in_progress: "In progress",
  delivered: "Delivered",
  declined: "Declined",
  cancelled: "Cancelled",
};

const ICON: Record<string, string> = {
  website: "▤",
  landing_video: "▶",
  content_pipeline: "✎",
  instagram_automation: "◎",
  whatsapp_automation: "✉",
};

export default function GrowPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([growthApi.services(), growthApi.requests()])
      .then(([s, r]) => {
        setServices(s.items);
        setRequests(r.items);
      })
      .catch(() => setFailed(true));
  }, []);

  const openFor = (key: string) =>
    requests.find((r) => r.service_key === key && ["requested", "quoted", "accepted", "in_progress"].includes(r.status));

  return (
    <>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">Grow your business</h1>
        <p className="text-sm text-text-2 mt-1">Done-for-you services from the Revyu team. Tell us what you need and we&rsquo;ll send a quote.</p>
      </div>

      {failed && <p role="alert" className="text-alert text-sm">We couldn&rsquo;t load services. Please refresh.</p>}
      {!services && !failed && <div className="ui-skeleton h-48 rounded-2xl" />}

      {requests.length > 0 && (
        <Card title="Your requests">
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/app/grow/requests/${r.id}`} className="flex items-center justify-between gap-3 min-h-[56px] py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink truncate">{r.service_name}</span>
                    <span className="block text-xs text-text-2">Requested {new Date(r.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.status === "quoted" ? "bg-[#fff4d6] text-[#8a5a00]" : "bg-paper-subtle text-text-2"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {services && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const open = openFor(s.key);
            return (
              <li key={s.id}>
                <Link
                  href={open ? `/app/grow/requests/${open.id}` : `/app/grow/${s.key}`}
                  className="v2-sheet border border-line p-5 h-full flex flex-col gap-3 hover:border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff]"
                >
                  <span aria-hidden className="w-11 h-11 rounded-xl bg-accent-50 text-accent-hover flex items-center justify-center text-xl">{ICON[s.key] ?? "✦"}</span>
                  <span>
                    <span className="block font-display text-lg text-ink">{s.name}</span>
                    <span className="block text-sm text-text-2 mt-0.5">{s.tagline}</span>
                  </span>
                  <span className="mt-auto flex items-center justify-between text-xs text-text-2">
                    <span>{s.lead_time_days ? `About ${s.lead_time_days} days` : "Custom timeline"}</span>
                    <span className="font-semibold text-accent-hover">{open ? "View request →" : "Get a quote →"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
