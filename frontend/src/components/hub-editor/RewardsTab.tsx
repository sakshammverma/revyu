"use client";

import { useCallback, useEffect, useState } from "react";

import type { TabProps } from "@/components/hub-editor/PageTab";
import { Icon } from "@/components/hub/Icons";
import { Btn, Card, EmptyState, Sheet, Switch, TextArea, TextInput } from "@/components/ui/kit";
import { HubApiError, formatMoney, type BadgeInput, type LoyaltyState, type MemberRow } from "@/lib/hub/api";

type BadgeRow = BadgeInput & { id?: string };

const TYPES: { value: BadgeInput["reward"]["type"]; label: string }[] = [
  { value: "percent_discount", label: "% discount" },
  { value: "amount_discount", label: "₹ discount" },
  { value: "freebie", label: "Freebie" },
  { value: "free_service", label: "Free service" },
];

const newBadge = (icons: string[]): BadgeRow => ({
  name: "", icon: icons[0] ?? "sparkle", visits_required: 5, active: true,
  reward: { type: "percent_discount", percent: 10, value_minor: null, title: "", terms: null, expires_days: 30 },
});

export function RewardsTab({ api, state, reload, toast }: TabProps) {
  const [data, setData] = useState<LoyaltyState | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [log, setLog] = useState<{ title: string; member: string; public_id: string; redeemed_at: string }[]>([]);
  const [draft, setDraft] = useState<BadgeRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [pin, setPin] = useState({ label: "", pin: "" });
  const [cooldown, setCooldown] = useState(12);
  const [terms, setTerms] = useState("");

  const load = useCallback(async () => {
    const d = await api.loyalty();
    setData(d);
    setCooldown(d.cooldown_hours);
    setTerms(d.terms ?? "");
  }, [api]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with external/async source on mount
  useEffect(() => { load().catch(() => toast("Couldn't load rewards.", "error")); }, [load, toast]);

  const fail = (e: unknown) => toast(e instanceof HubApiError ? e.message : "Something went wrong.", "error");

  async function acknowledge() {
    try { await api.acknowledge(); await load(); await reload(); } catch (e) { fail(e); }
  }

  async function saveBadge(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.id) await api.editBadge(draft.id, draft); else await api.addBadge(draft);
      setDraft(null);
      await load();
      await reload();
      toast("Badge saved");
    } catch (err) {
      setError(err instanceof HubApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="ui-skeleton h-48 rounded-2xl" />;

  if (!data.acknowledged)
    return (
      <Card title="Before you start">
        <p className="text-sm text-[#1a1e23] leading-relaxed">
          Rewards must never be offered for reviews. If you mention reviews alongside rewards in your own signage or
          staff scripts, that is outside our system and puts your Google profile at risk.
        </p>
        <p className="text-sm text-[#515a63] leading-relaxed mt-3">
          Badges here are earned only by visits that your staff confirm. You are responsible for honouring every reward you create.
        </p>
        <label className="flex items-start gap-3 mt-4 text-sm">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-5 h-5" />
          I understand and agree.
        </label>
        <Btn className="mt-4" disabled={!ack} onClick={acknowledge}>Continue</Btn>
      </Card>
    );

  const s = data.stats;
  const rewardLabel = (b: BadgeInput) =>
    b.reward.type === "percent_discount" && b.reward.percent ? `${b.reward.percent}% off`
    : b.reward.type === "amount_discount" && b.reward.value_minor ? `${formatMoney(b.reward.value_minor, "INR")} off`
    : b.reward.type === "free_service" ? "Free service" : "Freebie";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Members", s.members],
          ["Visits (30 days)", s.visits_30d],
          ["Badges earned", s.badges_awarded],
          ["Rewards used", s.rewards_redeemed],
        ].map(([l, v]) => (
          <div key={l} className="v2-sheet border border-[#e8ecec] p-3.5">
            <p className="text-2xl font-bold text-[#1a1e23]">{v}</p>
            <p className="text-xs text-[#59636a]">{l}</p>
          </div>
        ))}
      </div>

      <Card
        title="Badges and rewards"
        hint="Customers earn a badge after this many confirmed visits."
        action={<Btn variant="light" className="!min-h-[40px]" onClick={() => { setError(null); setDraft(newBadge(data.icons)); }}>+ Add badge</Btn>}
      >
        {data.badges.filter((b) => b.active).length === 0 ? (
          <EmptyState title="No badges yet" body="Try Regular at 5 visits: 10% off the next visit." />
        ) : (
          <ol className="flex flex-col gap-2">
            {data.badges.filter((b) => b.active).map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => { setError(null); setDraft(b); }} className="w-full text-left rounded-xl border border-[#e8ecec] p-3.5 flex items-center gap-3 hover:border-[#bfc8ca]">
                  <span className="w-10 h-10 rounded-xl bg-[#e7f5fd] text-[#2f68db] flex items-center justify-center shrink-0"><Icon name={b.icon} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#1a1e23]">{b.name} <span className="font-normal text-[#59636a]">· {b.visits_required} visits</span></span>
                    <span className="block text-sm text-[#515a63] truncate">{b.reward.title} ({rewardLabel(b)})</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Staff counter" hint="Staff sign in with a PIN to record visits and redeem rewards. They never need your login.">
        <p className="text-sm mb-3">
          Counter page: <a className="text-[#2f68db] font-semibold underline break-all" href={data.staff_url} target="_blank" rel="noreferrer">{data.staff_url}</a>
        </p>
        <ul className="divide-y divide-[#e8ecec] mb-3">
          {data.staff_pins.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center justify-between">
              <span className={p.active ? "font-medium" : "text-[#59636a] line-through"}>{p.label}</span>
              <Switch label={`${p.label} active`} checked={p.active} onChange={async (v) => { try { await api.setPinActive(p.id, v); await load(); } catch (e) { fail(e); } }} />
            </li>
          ))}
        </ul>
        <form
          className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await api.addPin(pin.label, pin.pin); setPin({ label: "", pin: "" }); await load(); toast("PIN added"); } catch (err) { fail(err); }
          }}
        >
          <TextInput label="Label" placeholder="Front desk" value={pin.label} onChange={(e) => setPin({ ...pin, label: e.target.value })} required />
          <TextInput label="PIN" inputMode="numeric" pattern="\d{4,6}" maxLength={6} placeholder="4-6 digits" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, "") })} required />
          <Btn type="submit" variant="light">Add</Btn>
        </form>
      </Card>

      <Card title="Programme settings">
        <div className="grid gap-3">
          <TextInput label="Hours between visits" type="number" min={0} max={720} value={cooldown} onChange={(e) => setCooldown(parseInt(e.target.value || "0", 10))} hint="A customer's visit counts once in this window." />
          <TextArea label="Terms shown to customers" maxLength={1000} value={terms} onChange={(e) => setTerms(e.target.value)} />
          <Btn className="self-start" onClick={async () => { try { await api.saveProgram(cooldown, terms || null); toast("Saved"); } catch (e) { fail(e); } }}>Save settings</Btn>
        </div>
      </Card>

      <Card
        title="Members"
        hint="Customers who joined your programme, with the details they gave you."
        action={members === null && <Btn variant="light" className="!min-h-[40px]" onClick={async () => { try { setMembers((await api.members()).items); setLog((await api.redemptions()).items); } catch (e) { fail(e); } }}>Show members</Btn>}
      >
        {members && (members.length === 0 ? (
          <EmptyState title="No members yet" body="They appear here when customers create a wallet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[#59636a]"><th className="py-2 pr-3 font-medium">Name</th><th className="pr-3 font-medium">Phone</th><th className="pr-3 font-medium">Visits</th><th className="font-medium">Contact OK</th></tr></thead>
              <tbody className="divide-y divide-[#e8ecec]">
                {members.map((m) => (
                  <tr key={m.id}><td className="py-2 pr-3 font-medium">{m.name}</td><td className="pr-3">{m.phone}</td><td className="pr-3">{m.visits}</td><td>{m.contact_consent ? "Yes" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {members && log.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold mb-2">Redemption log</h3>
            <ul className="text-sm divide-y divide-[#e8ecec]">
              {log.map((r, i) => (
                <li key={i} className="py-2 flex justify-between gap-3"><span>{r.title} · {r.member}</span><span className="text-[#59636a] shrink-0">{new Date(r.redeemed_at).toLocaleDateString()}</span></li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Sheet open={!!draft} title={draft?.id ? "Edit badge" : "New badge"} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={saveBadge} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Badge name" required maxLength={60} placeholder="Regular" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <TextInput label="Visits needed" type="number" min={1} max={1000} required value={draft.visits_required} onChange={(e) => setDraft({ ...draft, visits_required: parseInt(e.target.value || "1", 10) })} />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Icon</p>
              <div className="flex flex-wrap gap-2">
                {data.icons.map((ic) => (
                  <button key={ic} type="button" aria-label={ic} aria-pressed={draft.icon === ic} onClick={() => setDraft({ ...draft, icon: ic })}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border ${draft.icon === ic ? "bg-[#2f68db] text-white border-[#2f68db]" : "bg-white border-[#d5dcdc]"}`}><Icon name={ic} /></button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Reward</p>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button key={t.value} type="button" aria-pressed={draft.reward.type === t.value} onClick={() => setDraft({ ...draft, reward: { ...draft.reward, type: t.value } })}
                    className={`min-h-[40px] px-4 rounded-full text-sm font-semibold border ${draft.reward.type === t.value ? "bg-[#1f2429] text-white border-[#1f2429]" : "bg-white border-[#d5dcdc]"}`}>{t.label}</button>
                ))}
              </div>
            </div>
            {draft.reward.type === "percent_discount" && (
              <TextInput label="Discount %" type="number" min={1} max={100} value={draft.reward.percent ?? ""} onChange={(e) => setDraft({ ...draft, reward: { ...draft.reward, percent: parseInt(e.target.value, 10) || null } })} />
            )}
            {draft.reward.type === "amount_discount" && (
              <TextInput label="Discount amount (₹)" type="number" min={1} value={draft.reward.value_minor ? draft.reward.value_minor / 100 : ""} onChange={(e) => setDraft({ ...draft, reward: { ...draft.reward, value_minor: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null } })} />
            )}
            <TextInput label="Reward title" required maxLength={120} placeholder="10% off your next visit" value={draft.reward.title} onChange={(e) => setDraft({ ...draft, reward: { ...draft.reward, title: e.target.value } })} />
            <TextArea label="Terms (optional)" maxLength={400} value={draft.reward.terms ?? ""} onChange={(e) => setDraft({ ...draft, reward: { ...draft.reward, terms: e.target.value || null } })} />
            <TextInput label="Valid for (days, optional)" type="number" min={1} max={730} value={draft.reward.expires_days ?? ""} onChange={(e) => setDraft({ ...draft, reward: { ...draft.reward, expires_days: parseInt(e.target.value, 10) || null } })} />
            {error && <p className="text-sm text-[#c62445]" role="alert">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" busy={busy} className="flex-1">Save badge</Btn>
              {draft.id && (
                <Btn type="button" variant="danger" onClick={async () => { try { await api.retireBadge(draft.id!); setDraft(null); await load(); await reload(); toast("Badge retired"); } catch (e) { fail(e); } }}>Retire</Btn>
              )}
            </div>
            <p className="text-xs text-[#59636a]">Retiring hides a badge for new customers. Badges already earned are kept.</p>
          </form>
        )}
      </Sheet>
      <span className="sr-only">{state.slug}</span>
    </div>
  );
}
