"use client";

import { useCallback, useEffect, useState } from "react";

import { Btn, Card, EmptyState, Sheet, Switch, TextArea, TextInput, useToasts } from "@/components/ui/kit";
import {
  HubApiError,
  adminGrowthApi,
  formatMoney,
  type PrintKitOrder,
  type Service,
  type ServiceRequest,
} from "@/lib/hub/api";

const COLUMNS = [
  ["requested", "Requested"],
  ["quoted", "Quoted"],
  ["accepted", "Accepted"],
  ["in_progress", "In progress"],
  ["delivered", "Delivered"],
] as const;
const ALL_STATUS = [...COLUMNS.map((c) => c[0]), "declined", "cancelled"];
const age = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

type Tab = "requests" | "catalog" | "kits";

export function ServicesAdmin() {
  const [tab, setTab] = useState<Tab>("requests");
  const { push, node } = useToasts();
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-[#e8ecec] w-full sm:w-auto sm:self-start">
        {([["requests", "Requests"], ["catalog", "Catalogue"], ["kits", "Print kits"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 sm:flex-none min-h-[42px] px-5 rounded-lg text-sm font-semibold ${tab === k ? "bg-white shadow-sm text-[#1a1e23]" : "text-[#515a63]"}`}>{l}</button>
        ))}
      </div>
      {tab === "requests" && <Requests toast={push} />}
      {tab === "catalog" && <Catalog toast={push} />}
      {tab === "kits" && <Kits toast={push} />}
      {node}
    </div>
  );
}

type Toast = (t: string, k?: "ok" | "error") => void;
const fail = (toast: Toast, e: unknown) => toast(e instanceof HubApiError ? e.message : "Something went wrong.", "error");

/* ------------------------------------------------------------ requests */

function Requests({ toast }: { toast: Toast }) {
  const [items, setItems] = useState<ServiceRequest[] | null>(null);
  const [open, setOpen] = useState<ServiceRequest | null>(null);
  const [quote, setQuote] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => adminGrowthApi.requests().then((r) => setItems(r.items)).catch((e) => fail(toast, e)), [toast]);
  useEffect(() => { load(); }, [load]);

  async function show(r: ServiceRequest) {
    try {
      const full = await adminGrowthApi.request(r.id);
      setOpen(full);
      setQuote(full.quoted_amount_minor ? String(full.quoted_amount_minor / 100) : "");
      setMessage("");
      setNote("");
    } catch (e) { fail(toast, e); }
  }

  async function update(body: Parameters<typeof adminGrowthApi.update>[1]) {
    if (!open) return;
    setBusy(true);
    try {
      setOpen(await adminGrowthApi.update(open.id, body));
      setMessage("");
      setNote("");
      await load();
      toast("Updated");
    } catch (e) { fail(toast, e); } finally { setBusy(false); }
  }

  if (!items) return <div className="ui-skeleton h-64 rounded-2xl" />;
  if (!items.length) return <EmptyState title="No requests yet" body="Owner requests from the Grow page appear here." />;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-5 items-start overflow-x-auto">
        {COLUMNS.map(([status, label]) => {
          const col = items.filter((r) => r.status === status);
          return (
            <section key={status} aria-label={label} className="bg-[#e8ecec]/60 rounded-xl p-2.5 min-w-[220px]">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#515a63] px-1 mb-2">{label} · {col.length}</h2>
              <ul className="flex flex-col gap-2">
                {col.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => show(r)} className="w-full text-left bg-white rounded-lg border border-[#e8ecec] p-3 hover:border-[#bfc8ca]">
                      <span className="block font-semibold text-sm text-[#1a1e23]">{r.business_name}</span>
                      <span className="block text-xs text-[#515a63]">{r.service_name}</span>
                      <span className={`block text-xs mt-1 ${age(r.updated_at) > 3 && status !== "delivered" ? "text-[#b45309] font-semibold" : "text-[#59636a]"}`}>{age(r.updated_at)}d in stage</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <Sheet open={!!open} title={open ? `${open.service_name} · ${open.business_name}` : ""} onClose={() => setOpen(null)}>
        {open && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#515a63]">{open.owner_email}</p>
            {open.brief && <p className="text-sm bg-[#f2f7f7] rounded-lg p-3 whitespace-pre-line">{open.brief}</p>}
            {open.answers && Object.keys(open.answers).length > 0 && (
              <dl className="text-sm grid gap-1">
                {Object.entries(open.answers).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-[#59636a] shrink-0">{k}:</dt><dd>{v}</dd></div>)}
              </dl>
            )}

            <label className="text-sm font-medium">
              Status
              <select value={open.status} onChange={(e) => update({ status: e.target.value })} disabled={busy} className="mt-1 w-full rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5">
                {ALL_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <TextInput label="Quote (₹)" inputMode="decimal" value={quote} onChange={(e) => setQuote(e.target.value)} />
              <Btn variant="light" disabled={!quote || busy} onClick={() => update({ quoted_amount_minor: Math.round(parseFloat(quote) * 100), status: open.status === "requested" ? "quoted" : undefined })}>
                {open.status === "requested" ? "Send quote" : "Update"}
              </Btn>
            </div>
            {open.quoted_amount_minor !== null && <p className="text-xs text-[#59636a] -mt-2">Current: {formatMoney(open.quoted_amount_minor, open.currency_code)}</p>}

            <div>
              <TextArea label="Message to owner (emailed)" value={message} onChange={(e) => setMessage(e.target.value)} />
              <Btn className="mt-2" disabled={!message.trim() || busy} onClick={() => update({ message })}>Send message</Btn>
            </div>
            <div>
              <TextArea label="Internal note (owner never sees this)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Btn variant="light" className="mt-2" disabled={!note.trim() || busy} onClick={() => update({ note })}>Save note</Btn>
            </div>

            <ul className="border-t border-[#e8ecec] pt-3 flex flex-col gap-1.5 text-sm">
              {(open.events ?? []).map((e) => (
                <li key={e.id} className={e.kind === "note" ? "text-[#b45309]" : ""}>
                  <span className="text-[#59636a]">{new Date(e.created_at).toLocaleString()} · {e.actor}{e.kind === "note" ? " (internal)" : ""}:</span> {e.body}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------- catalogue */

type SvcDraft = { id: string | null; key: string; name: string; tagline: string; description_md: string; deliverables: string; lead_time_days: string; active: boolean; sort_order: number; questions: Service["questions"] };

function Catalog({ toast }: { toast: Toast }) {
  const [items, setItems] = useState<Service[] | null>(null);
  const [draft, setDraft] = useState<SvcDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => adminGrowthApi.services().then((r) => setItems(r.items)).catch((e) => fail(toast, e)), [toast]);
  useEffect(() => { load(); }, [load]);

  const edit = (s: Service | null): void =>
    setDraft(s
      ? { id: s.id, key: s.key, name: s.name, tagline: s.tagline, description_md: s.description_md, deliverables: s.deliverables.join("\n"), lead_time_days: s.lead_time_days ? String(s.lead_time_days) : "", active: s.active ?? true, sort_order: s.sort_order ?? 0, questions: s.questions }
      : { id: null, key: "", name: "", tagline: "", description_md: "", deliverables: "", lead_time_days: "", active: true, sort_order: (items?.length ?? 0), questions: [] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await adminGrowthApi.saveService(draft.id, {
        key: draft.key, name: draft.name, tagline: draft.tagline, description_md: draft.description_md,
        deliverables: draft.deliverables.split("\n").map((x) => x.trim()).filter(Boolean),
        questions: draft.questions, lead_time_days: draft.lead_time_days ? parseInt(draft.lead_time_days, 10) : null,
        active: draft.active, sort_order: draft.sort_order,
      });
      setDraft(null);
      await load();
      toast("Saved");
    } catch (err) { fail(toast, err); } finally { setBusy(false); }
  }

  if (!items) return <div className="ui-skeleton h-48 rounded-2xl" />;
  return (
    <Card title="Service catalogue" hint="No prices are shown to owners. Each request is quoted." action={<Btn className="!min-h-[40px]" onClick={() => edit(null)}>+ New service</Btn>}>
      <ul className="divide-y divide-[#e8ecec]">
        {items.map((s) => (
          <li key={s.id} className="py-3 flex items-center gap-3">
            <button type="button" className="flex-1 text-left min-w-0" onClick={() => edit(s)}>
              <span className={`block font-semibold ${s.active ? "" : "text-[#59636a] line-through"}`}>{s.name}</span>
              <span className="block text-sm text-[#515a63] truncate">{s.tagline}</span>
            </button>
            <span className="text-xs text-[#59636a] shrink-0">{s.key}</span>
          </li>
        ))}
      </ul>
      <Sheet open={!!draft} title={draft?.id ? "Edit service" : "New service"} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={save} className="flex flex-col gap-3">
            <TextInput label="Name" required value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextInput label="Key" required disabled={!!draft.id} pattern="[a-z0-9_]{2,40}" hint="Lowercase letters, numbers and underscores" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} />
            <TextInput label="Tagline" required maxLength={160} value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
            <TextArea label="Description" rows={5} value={draft.description_md} onChange={(e) => setDraft({ ...draft, description_md: e.target.value })} />
            <TextArea label="Deliverables (one per line)" rows={4} value={draft.deliverables} onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })} />
            <TextInput label="Lead time (days)" type="number" min={1} value={draft.lead_time_days} onChange={(e) => setDraft({ ...draft, lead_time_days: e.target.value })} />
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Visible to owners</span><Switch label="Active" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} /></div>
            <Btn type="submit" busy={busy}>Save service</Btn>
          </form>
        )}
      </Sheet>
    </Card>
  );
}

/* ------------------------------------------------------------ print kits */

function Kits({ toast }: { toast: Toast }) {
  const [items, setItems] = useState<PrintKitOrder[] | null>(null);
  const load = useCallback(() => adminGrowthApi.printKits().then((r) => setItems(r.items)).catch((e) => fail(toast, e)), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!items) return <div className="ui-skeleton h-48 rounded-2xl" />;
  if (!items.length) return <EmptyState title="No delivery requests" body="Owners who ask for delivery appear here." />;
  return (
    <Card title="Print kit deliveries">
      <ul className="divide-y divide-[#e8ecec]">
        {items.map((k) => (
          <li key={k.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{k.business_name}</p>
              <p className="text-sm text-[#515a63] whitespace-pre-line">{k.address}</p>
              <p className="text-xs text-[#59636a]">{k.phone} · {formatMoney(k.fee_minor, k.currency_code)}</p>
            </div>
            <select aria-label="Status" value={k.status} onChange={async (e) => { try { await adminGrowthApi.setKitStatus(k.id, e.target.value); await load(); } catch (err) { fail(toast, err); } }} className="rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm">
              {["requested", "paid", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </Card>
  );
}
