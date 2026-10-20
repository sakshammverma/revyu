"use client";

import { useCallback, useEffect, useState } from "react";

import { Btn, Card, EmptyState, TextInput, useToasts } from "@/components/ui/kit";
import { fetchAdminPricing, saveAdminCountry, saveAdminPlanPrice, type AdminPricing } from "@/lib/admin/api";
import { formatMoney } from "@/lib/format";

type Plan = AdminPricing["plans"][number];
const selectCls = "w-full rounded-lg border border-[#d5dcdc] bg-white px-3.5 py-2.5 text-base text-[#1a1e23]";

export function PricingAdmin() {
  const [data, setData] = useState<AdminPricing | null>(null);
  const { push, node } = useToasts();

  const load = useCallback(
    () => fetchAdminPricing().then(setData).catch(() => push("Could not load pricing.", "error")),
    [push],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="max-w-6xl mx-auto text-sm text-[#515a63]">Loading…</p>;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4">
      <p className="text-sm text-[#515a63]">
        A business pays the price of its own country&rsquo;s tier and currency. Changing a price adds a new row and
        keeps the old one as history; existing subscriptions are not repriced here. Non-INR prices need the
        gateway&rsquo;s recurring plan id for that exact amount, or checkout falls back to a one-time payment.
      </p>
      <Plans data={data} onSaved={setData} toast={push} />
      <Countries data={data} onSaved={setData} toast={push} />
      {node}
    </div>
  );
}

type Toast = (t: string, k?: "ok" | "error") => void;

function Plans({ data, onSaved, toast }: { data: AdminPricing; onSaved: (d: AdminPricing) => void; toast: Toast }) {
  return (
    <Card title="Plan prices" hint="One active price per plan, tier and currency.">
      {data.plans.length === 0 ? (
        <EmptyState title="No prices yet" />
      ) : (
        <div className="flex flex-col divide-y divide-[#e8ecec]">
          {data.plans.map((p) => (
            <PlanRow key={`${p.tier_code}-${p.currency_code}-${p.code}`} plan={p} onSaved={onSaved} toast={toast} />
          ))}
        </div>
      )}
      <NewPrice tiers={data.tiers} onSaved={onSaved} toast={toast} />
    </Card>
  );
}

function PlanRow({ plan, onSaved, toast }: { plan: Plan; onSaved: (d: AdminPricing) => void; toast: Toast }) {
  const [price, setPrice] = useState(String(plan.amount_minor / 100));
  const [planId, setPlanId] = useState(plan.provider_plan_id ?? "");
  const [busy, setBusy] = useState(false);
  const amount = Math.round(Number(price) * 100);
  const dirty = amount !== plan.amount_minor || planId !== (plan.provider_plan_id ?? "");

  async function save() {
    setBusy(true);
    try {
      onSaved(
        await saveAdminPlanPrice({
          code: plan.code,
          tier_code: plan.tier_code ?? "",
          currency_code: plan.currency_code,
          amount_minor: amount,
          provider_plan_id: planId.trim() || null,
        }),
      );
      toast("Price saved");
    } catch {
      toast("Could not save that price.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-3 grid gap-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
      <div>
        <p className="font-semibold text-[#1a1e23]">
          {plan.tier_code} · {plan.code}
        </p>
        <p className="text-xs text-[#515a63]">
          {plan.currency_code} · now {formatMoney(plan.amount_minor, plan.currency_code)}
        </p>
      </div>
      <TextInput label={`Price (${plan.currency_code})`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <TextInput label="Gateway plan id" placeholder="plan_…" value={planId} onChange={(e) => setPlanId(e.target.value)} />
      <Btn onClick={save} busy={busy} disabled={!dirty || !(amount > 0)}>
        Save
      </Btn>
    </div>
  );
}

function NewPrice({ tiers, onSaved, toast }: { tiers: AdminPricing["tiers"]; onSaved: (d: AdminPricing) => void; toast: Toast }) {
  const [tier, setTier] = useState(tiers[0]?.code ?? "");
  const [code, setCode] = useState("monthly");
  const [cur, setCur] = useState("");
  const [price, setPrice] = useState("");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = Math.round(Number(price) * 100);

  async function add() {
    setBusy(true);
    try {
      onSaved(
        await saveAdminPlanPrice({ code, tier_code: tier, currency_code: cur.toUpperCase(), amount_minor: amount, provider_plan_id: planId.trim() || null }),
      );
      setPrice("");
      setPlanId("");
      toast("Price added");
    } catch {
      toast("Could not add that price (check the currency code).", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#e8ecec]">
      <h3 className="text-sm font-semibold text-[#1a1e23] mb-2">Add or replace a price</h3>
      <div className="grid gap-3 sm:grid-cols-6 sm:items-end">
        <label className="text-sm font-medium flex flex-col gap-1">
          Tier
          <select className={selectCls} value={tier} onChange={(e) => setTier(e.target.value)}>
            {tiers.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium flex flex-col gap-1">
          Plan
          <select className={selectCls} value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="monthly">monthly</option>
            <option value="annual">annual</option>
          </select>
        </label>
        <TextInput label="Currency" maxLength={3} placeholder="USD" value={cur} onChange={(e) => setCur(e.target.value)} />
        <TextInput label="Price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <TextInput label="Gateway plan id" value={planId} onChange={(e) => setPlanId(e.target.value)} />
        <Btn onClick={add} busy={busy} disabled={cur.length !== 3 || !(amount > 0)}>
          Save price
        </Btn>
      </div>
    </div>
  );
}

function Countries({ data, onSaved, toast }: { data: AdminPricing; onSaved: (d: AdminPricing) => void; toast: Toast }) {
  const [country, setCountry] = useState("");
  const [tier, setTier] = useState(data.tiers[0]?.code ?? "");
  const [cur, setCur] = useState("");
  const [locale, setLocale] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(active = true) {
    setBusy(true);
    try {
      onSaved(await saveAdminCountry({ country_code: country.trim().toUpperCase(), tier_code: tier, currency_code: cur.toUpperCase(), locale: locale.trim(), active }));
      toast("Country saved");
    } catch {
      toast("Could not save that country.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Countries" hint="Which tier and currency each country pays. '*' is the fallback for any country not listed.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#515a63]">
              <th className="py-1 pr-3">Country</th>
              <th className="pr-3">Tier</th>
              <th className="pr-3">Currency</th>
              <th className="pr-3">Locale</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.countries.map((c) => (
              <tr key={c.country_code} className={`border-t border-[#e8ecec] ${c.active ? "" : "opacity-50"}`}>
                <td className="py-1.5 pr-3 font-semibold">{c.country_code}</td>
                <td className="pr-3">{c.tier_code}</td>
                <td className="pr-3">{c.currency_code}</td>
                <td className="pr-3">{c.locale}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="text-[#2f6df0] font-semibold px-2 min-h-[36px]"
                    onClick={() => {
                      setCountry(c.country_code);
                      setTier(c.tier_code);
                      setCur(c.currency_code);
                      setLocale(c.locale);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t border-[#e8ecec] grid gap-3 sm:grid-cols-5 sm:items-end">
        <TextInput label="Country (ISO or *)" maxLength={2} placeholder="DE" value={country} onChange={(e) => setCountry(e.target.value)} />
        <label className="text-sm font-medium flex flex-col gap-1">
          Tier
          <select className={selectCls} value={tier} onChange={(e) => setTier(e.target.value)}>
            {data.tiers.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code}
              </option>
            ))}
          </select>
        </label>
        <TextInput label="Currency" maxLength={3} placeholder="EUR" value={cur} onChange={(e) => setCur(e.target.value)} />
        <TextInput label="Locale" placeholder="de-DE" value={locale} onChange={(e) => setLocale(e.target.value)} />
        <Btn onClick={() => save()} busy={busy} disabled={country.length !== 2 && country !== "*" || cur.length !== 3 || locale.length < 2}>
          Save country
        </Btn>
      </div>
    </Card>
  );
}
