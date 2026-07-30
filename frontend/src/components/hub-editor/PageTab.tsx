"use client";

import { useState } from "react";

import { Btn, Card, Segmented, Switch, TextArea, TextInput } from "@/components/ui/kit";
import { HubApiError, type EditorState, type HubApi, type ProfileData } from "@/lib/hub/api";

const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
] as const;

type Day = { closed: boolean; open: string; close: string };

function toDays(hours: ProfileData["hours"]): Record<string, Day> {
  const out: Record<string, Day> = {};
  for (const [k] of DAYS) {
    const slot = hours?.[k]?.[0];
    out[k] = slot ? { closed: false, open: slot[0], close: slot[1] } : { closed: !!hours, open: "09:00", close: "18:00" };
  }
  return out;
}

export interface TabProps {
  api: HubApi;
  state: EditorState;
  reload: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "error", undo?: () => void) => void;
  isAdmin: boolean;
}

function errText(e: unknown) {
  return e instanceof HubApiError ? e.message : "Couldn't save. Please try again.";
}

export function PageTab({ api, state, reload, toast, isAdmin }: TabProps) {
  const [profile, setProfile] = useState<ProfileData>(state.profile);
  const [days, setDays] = useState(() => toDays(state.profile.hours));
  const [hoursSet, setHoursSet] = useState(!!state.profile.hours);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function saveModules(next: { module: string; enabled: boolean }[], undo?: () => void) {
    try {
      await api.setModules(next);
      await reload();
      toast("Saved", "ok", undo);
    } catch (e) {
      toast(errText(e), "error");
      await reload();
    }
  }

  const list = state.modules.map((m) => ({ module: m.key, enabled: m.enabled }));

  function toggle(key: string, enabled: boolean) {
    const before = list;
    saveModules(list.map((m) => (m.module === key ? { ...m, enabled } : m)), () => saveModules(before));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    saveModules(next);
  }

  async function setMode(m: "direct" | "menu") {
    try {
      await api.setMode(m);
      await reload();
      toast(m === "menu" ? "Customers will see your page" : "Customers go straight to the form");
    } catch (e) {
      toast(errText(e), "error");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const hours = hoursSet
        ? Object.fromEntries(DAYS.map(([k]) => [k, days[k].closed ? [] : [[days[k].open, days[k].close]]]))
        : null;
      await api.saveProfile({ ...profile, hours });
      await reload();
      toast("Business details saved");
    } catch (err) {
      toast(errText(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setProfile({ ...profile, cover_image_url: await api.upload(file) });
    } catch (e) {
      toast(errText(e), "error");
    } finally {
      setUploading(false);
    }
  }

  const enabledCount = state.modules.filter((m) => m.enabled && m.available).length;

  return (
    <div className="flex flex-col gap-4">
      <Card title="When customers scan your QR">
        <Segmented
          label="Scan behaviour"
          value={state.hub_mode}
          onChange={setMode}
          options={[
            { value: "direct", label: "Go straight to the form" },
            { value: "menu", label: "Show my page" },
          ]}
        />
        <p className="text-xs text-[#59636a] mt-2">
          Your QR code never changes. {state.hub_mode === "menu" && enabledCount < 2 ? "Turn on at least two modules below for your page to appear." : ""}
        </p>
      </Card>

      <Card title="Modules" hint="Choose what customers can open, and in what order.">
        <ul className="flex flex-col divide-y divide-[#e8ecec]">
          {state.modules.map((m, i) => (
            <li key={m.key} className="py-3 flex items-center gap-3">
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${m.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="w-8 h-6 text-[#515a63] disabled:opacity-25">▲</button>
                <button type="button" aria-label={`Move ${m.label} down`} disabled={i === state.modules.length - 1} onClick={() => move(i, 1)} className="w-8 h-6 text-[#515a63] disabled:opacity-25">▼</button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1a1e23]">{m.label}</p>
                {!m.available && !isAdmin && <p className="text-xs text-[#59636a]">Not available for your page yet. Ask us to enable it.</p>}
                {m.available && !m.enabled && m.blocked_reason && <p className="text-xs text-[#b45309]">{m.blocked_reason}</p>}
                {isAdmin && (
                  <label className="text-xs text-[#515a63] inline-flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={m.available}
                      disabled={m.key === "review"}
                      onChange={async (e) => {
                        try { await api.setAvailability(m.key, e.target.checked); await reload(); toast("Availability updated"); }
                        catch (err) { toast(errText(err), "error"); }
                      }}
                    />
                    Available to owner
                  </label>
                )}
              </div>
              <Switch
                label={`${m.label} on or off`}
                checked={m.enabled}
                disabled={m.key === "review" ? false : !m.available && !isAdmin}
                onChange={(v) => toggle(m.key, v)}
              />
            </li>
          ))}
        </ul>
      </Card>

      <form onSubmit={saveProfile}>
        <Card title="Business details" hint="Shown at the top of your page and in Connect.">
          <div className="grid gap-3">
            <TextInput label="Tagline" maxLength={160} value={profile.tagline ?? ""} onChange={(e) => setProfile({ ...profile, tagline: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <TextInput label="Address" maxLength={240} value={profile.address_line ?? ""} onChange={(e) => setProfile({ ...profile, address_line: e.target.value })} />
              <TextInput label="Area / locality" maxLength={120} value={profile.locality ?? ""} onChange={(e) => setProfile({ ...profile, locality: e.target.value })} />
            </div>
            <TextInput label="Phone" type="tel" maxLength={32} value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />

            <div className="flex items-center gap-3">
              {profile.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.cover_image_url} alt="" className="w-24 h-14 rounded-lg object-cover" />
              )}
              <label className="btn-pill-light min-h-[44px] inline-flex items-center cursor-pointer">
                {uploading ? "Uploading…" : profile.cover_image_url ? "Change cover photo" : "Add cover photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {profile.cover_image_url && (
                <button type="button" className="text-sm text-[#515a63] underline" onClick={() => setProfile({ ...profile, cover_image_url: null })}>Remove</button>
              )}
            </div>

            <fieldset className="border-t border-[#e8ecec] pt-3">
              <legend className="sr-only">Opening hours</legend>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-[#1a1e23]">Opening hours</p>
                <Switch label="Show opening hours" checked={hoursSet} onChange={setHoursSet} />
              </div>
              {hoursSet && (
                <ul className="flex flex-col gap-2">
                  {DAYS.map(([k, label]) => (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className="w-20 text-[#515a63]">{label.slice(0, 3)}</span>
                      <label className="inline-flex items-center gap-1.5 w-20">
                        <input type="checkbox" checked={days[k].closed} onChange={(e) => setDays({ ...days, [k]: { ...days[k], closed: e.target.checked } })} /> Closed
                      </label>
                      {!days[k].closed && (
                        <>
                          <input aria-label={`${label} opens`} type="time" value={days[k].open} onChange={(e) => setDays({ ...days, [k]: { ...days[k], open: e.target.value } })} className="rounded-lg border border-[#d5dcdc] px-2 py-1.5" />
                          <span>–</span>
                          <input aria-label={`${label} closes`} type="time" value={days[k].close} onChange={(e) => setDays({ ...days, [k]: { ...days[k], close: e.target.value } })} className="rounded-lg border border-[#d5dcdc] px-2 py-1.5" />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <Btn type="submit" busy={busy} className="self-start">Save details</Btn>
          </div>
        </Card>
      </form>
    </div>
  );
}

export { TextArea };
