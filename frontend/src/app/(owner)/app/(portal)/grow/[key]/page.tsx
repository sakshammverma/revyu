"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Card, ErrorState, Skeleton } from "@/components/ui";
import { Btn, TextArea, TextInput } from "@/components/ui/kit";
import { HubApiError, growthApi } from "@/lib/hub/api";
import { useAsync } from "@/lib/useAsync";

export default function ServiceDetailPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const services = useAsync(() => growthApi.services(), []);
  const service = services.data?.items.find((s) => s.key === key) ?? null;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || busy) return;
    setBusy(true);
    setError(null);
    try {
      const req = await growthApi.create({ service_key: service.key, brief: brief || null, answers });
      router.push(`/app/grow/requests/${req.id}`);
    } catch (err) {
      if (err instanceof HubApiError && err.code === "ALREADY_REQUESTED") {
        // Take them to the request they already have, not back to the list.
        router.push(err.id ? `/app/grow/requests/${err.id}` : "/app/grow");
        return;
      }
      setError(err instanceof HubApiError ? err.message : "Couldn't send your request.");
      setBusy(false);
    }
  }

  if (!service) {
    if (services.loading) return <Skeleton className="h-64 rounded-2xl" />;
    if (services.error) return <ErrorState message="We couldn't load this service." onRetry={services.reload} />;
    return <p className="text-sm text-text-2">Service not found. <Link className="underline" href="/app/grow">Back</Link></p>;
  }

  return (
    <>
      <Link href="/app/grow" className="text-sm font-semibold text-text-2 min-h-[44px] inline-flex items-center">← All services</Link>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">{service.name}</h1>
        <p className="text-text-2 mt-1">{service.tagline}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
        <div className="flex flex-col gap-4">
          {service.description_md && <Card><p className="text-sm text-ink leading-relaxed whitespace-pre-line">{service.description_md}</p></Card>}
          {service.deliverables.length > 0 && (
            <Card title="What you get">
              <ul className="flex flex-col gap-2">
                {service.deliverables.map((d) => (
                  <li key={d} className="flex gap-2.5 text-sm text-ink"><span aria-hidden className="text-[#449127] font-bold">✓</span>{d}</li>
                ))}
              </ul>
              {service.lead_time_days && <p className="text-xs text-text-2 mt-4">Typical turnaround: about {service.lead_time_days} days after we agree the details.</p>}
            </Card>
          )}
        </div>

        <form onSubmit={submit}>
          <Card title="Request a quote" description="No payment now. We review your request and send you a price.">
            <div className="flex flex-col gap-3">
              {service.questions.map((q) =>
                q.type === "choice" ? (
                  <label key={q.key} className="text-sm font-medium text-ink flex flex-col gap-1">
                    {q.label}
                    <select required value={answers[q.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} className="rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-base">
                      <option value="">Choose…</option>
                      {q.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                ) : (
                  <TextInput key={q.key} label={q.label} required maxLength={500} value={answers[q.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} />
                )
              )}
              <TextArea label="Anything else we should know?" maxLength={2000} value={brief} onChange={(e) => setBrief(e.target.value)} />
              {error && <p className="text-sm text-alert" role="alert">{error}</p>}
              <Btn type="submit" busy={busy}>Send request</Btn>
            </div>
          </Card>
        </form>
      </div>
    </>
  );
}
