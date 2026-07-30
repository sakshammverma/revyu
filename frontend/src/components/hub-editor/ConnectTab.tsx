"use client";

import { useState } from "react";

import type { TabProps } from "@/components/hub-editor/PageTab";
import { Btn, Card, EmptyState, Switch } from "@/components/ui/kit";
import { HubApiError, type EditorLink } from "@/lib/hub/api";

const KINDS: { value: string; label: string; placeholder: string }[] = [
  { value: "instagram", label: "Instagram", placeholder: "@yourhandle or instagram.com/yourhandle" },
  { value: "facebook", label: "Facebook", placeholder: "facebook.com/yourpage" },
  { value: "youtube", label: "YouTube", placeholder: "youtube.com/@yourchannel" },
  { value: "whatsapp", label: "WhatsApp chat", placeholder: "Number with country code, e.g. 919876543210" },
  { value: "website", label: "Website", placeholder: "yourwebsite.com" },
  { value: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { value: "email", label: "Email", placeholder: "hello@yourbusiness.com" },
  { value: "google_maps", label: "Google Maps (override)", placeholder: "Paste your Google Maps link" },
  { value: "custom", label: "Other link", placeholder: "https://" },
];

export function ConnectTab({ api, state, reload, toast }: TabProps) {
  const [links, setLinks] = useState<EditorLink[]>(state.links);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(links) !== JSON.stringify(state.links);

  const update = (i: number, patch: Partial<EditorLink>) => setLinks(links.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    setLinks(next);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.saveLinks(links.filter((l) => l.url.trim()));
      await reload();
      toast("Links saved");
    } catch (e) {
      setError(e instanceof HubApiError ? e.message : "Couldn't save your links.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Connect with us" hint="The links customers see. Only filled-in links are shown.">
        {state.google_maps_auto && !links.some((l) => l.kind === "google_maps") && (
          <p className="text-sm text-[#2f7a16] bg-[#f0f8ec] rounded-lg px-3 py-2 mb-3">
            Directions are filled in automatically from your Google profile.
          </p>
        )}
        {links.length === 0 ? (
          <EmptyState title="No links yet" body="Add your Instagram, WhatsApp, website and more." />
        ) : (
          <ul className="flex flex-col gap-3">
            {links.map((l, i) => {
              const k = KINDS.find((x) => x.value === l.kind);
              return (
                <li key={i} className="rounded-xl border border-[#e8ecec] p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Link type"
                      value={l.kind}
                      onChange={(e) => update(i, { kind: e.target.value })}
                      className="rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm font-medium flex-1 min-w-0"
                    >
                      {KINDS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                    <Switch label="Show this link" checked={l.enabled} onChange={(v) => update(i, { enabled: v })} />
                  </div>
                  <input
                    aria-label="Link address"
                    value={l.url}
                    onChange={(e) => update(i, { url: e.target.value })}
                    placeholder={k?.placeholder}
                    className="w-full rounded-lg border border-[#d5dcdc] px-3.5 py-2.5 text-base outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25"
                  />
                  {(l.kind === "custom" || l.kind === "website") && (
                    <input
                      aria-label="Button label (optional)"
                      value={l.label ?? ""}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="Button label (optional)"
                      maxLength={60}
                      className="w-full rounded-lg border border-[#d5dcdc] px-3.5 py-2 text-sm"
                    />
                  )}
                  <div className="flex gap-2 text-sm">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="px-2 py-1 text-[#515a63] disabled:opacity-30">↑ Up</button>
                    <button type="button" disabled={i === links.length - 1} onClick={() => move(i, 1)} className="px-2 py-1 text-[#515a63] disabled:opacity-30">↓ Down</button>
                    <button type="button" onClick={() => setLinks(links.filter((_, n) => n !== i))} className="px-2 py-1 text-[#c62445] ml-auto">Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="text-sm text-[#c62445] mt-3" role="alert">{error}</p>}
        <div className="flex gap-2 mt-4">
          <Btn variant="light" onClick={() => setLinks([...links, { kind: "instagram", label: null, url: "", enabled: true }])}>+ Add link</Btn>
          <Btn onClick={save} busy={busy} disabled={!dirty}>Save links</Btn>
        </div>
      </Card>
    </div>
  );
}
