"use client";

import { useState } from "react";

import type { TabProps } from "@/components/hub-editor/PageTab";
import { Btn, Card, EmptyState, Sheet, Switch, TextArea, TextInput } from "@/components/ui/kit";
import { HubApiError, formatMoney, type ItemInput, type MenuItemData } from "@/lib/hub/api";

const DIET = [["veg", "Veg"], ["non_veg", "Non-veg"], ["vegan", "Vegan"], ["egg", "Egg"]] as const;

interface Draft extends ItemInput {
  id?: string;
  price: string;
}

const blank = (category_id: string): Draft => ({
  category_id, name: "", description: "", amount_minor: null, price_on_request: false,
  price_prefix: null, duration_min: null, dietary: [], photo_url: null, available: true, price: "",
});

const fromItem = (i: MenuItemData): Draft => ({
  id: i.id, category_id: i.category_id, name: i.name, description: i.description,
  amount_minor: i.amount_minor, price_on_request: i.price_on_request, price_prefix: i.price_prefix,
  duration_min: i.duration_min, dietary: i.dietary, photo_url: i.photo_url, available: i.available,
  price: i.amount_minor === null ? "" : String(i.amount_minor / 100),
});

export function MenuTab({ api, state, reload, toast }: TabProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const label = state.menu_label;

  const fail = (e: unknown) => toast(e instanceof HubApiError ? e.message : "Something went wrong.", "error");

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    try { await api.addCategory(newCat.trim()); setNewCat(""); await reload(); } catch (err) { fail(err); }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const price = parseFloat(draft.price);
    if (!draft.price_on_request && draft.price && (isNaN(price) || price < 0)) {
      setError("Enter a valid price.");
      setBusy(false);
      return;
    }
    const body: ItemInput = {
      category_id: draft.category_id, name: draft.name, description: draft.description || null,
      amount_minor: draft.price_on_request || !draft.price ? null : Math.round(price * 100),
      price_on_request: draft.price_on_request || !draft.price,
      price_prefix: draft.price_prefix, duration_min: draft.duration_min, dietary: draft.dietary,
      photo_url: draft.photo_url, available: draft.available,
    };
    try {
      if (draft.id) await api.editItem(draft.id, body); else await api.addItem(body);
      setDraft(null);
      await reload();
      toast("Saved");
    } catch (err) {
      setError(err instanceof HubApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function quickToggle(i: MenuItemData) {
    try {
      await api.editItem(i.id, {
        category_id: i.category_id, name: i.name, description: i.description, amount_minor: i.amount_minor,
        price_on_request: i.price_on_request, price_prefix: i.price_prefix, duration_min: i.duration_min,
        dietary: i.dietary, photo_url: i.photo_url, available: !i.available,
      });
      await reload();
    } catch (err) { fail(err); }
  }

  async function upload(file?: File) {
    if (!file || !draft) return;
    setUploading(true);
    try { setDraft({ ...draft, photo_url: await api.upload(file) }); } catch (e) { fail(e); } finally { setUploading(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {state.menu.length === 0 && (
        <EmptyState title={`Your ${label.toLowerCase()} is empty`} body="Start with a category, like “Haircuts” or “Starters”, then add items to it." />
      )}

      {state.menu.map((c) => (
        <Card
          key={c.id}
          title={c.name}
          action={
            <div className="flex gap-2">
              <Btn variant="light" className="!min-h-[40px]" onClick={() => { setError(null); setConfirmDel(false); setDraft(blank(c.id)); }}>+ Add item</Btn>
              <button
                type="button"
                className="text-sm text-[#c62445] px-2"
                onClick={async () => {
                  if (c.items.length && !window.confirm(`Delete “${c.name}” and its ${c.items.length} items?`)) return;
                  try { await api.deleteCategory(c.id); await reload(); } catch (err) { fail(err); }
                }}
              >Delete</button>
            </div>
          }
        >
          {c.items.length === 0 ? (
            <p className="text-sm text-[#59636a]">No items yet.</p>
          ) : (
            <ul className="divide-y divide-[#e8ecec]">
              {c.items.map((i) => (
                <li key={i.id} className="py-3 flex items-center gap-3">
                  {i.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => { setError(null); setConfirmDel(false); setDraft(fromItem(i)); }}>
                    <span className={`block font-semibold ${i.available ? "text-[#1a1e23]" : "text-[#59636a] line-through"}`}>{i.name}</span>
                    <span className="block text-sm text-[#515a63]">
                      {i.price_on_request || i.amount_minor === null ? "Price on request" : formatMoney(i.amount_minor, i.currency_code)}
                    </span>
                  </button>
                  <Switch label={`${i.name} available`} checked={i.available} onChange={() => quickToggle(i)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <form onSubmit={addCategory} className="flex gap-2">
        <input
          aria-label="New category name"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          maxLength={80}
          placeholder="New category, e.g. Haircuts"
          className="flex-1 min-w-0 rounded-lg border border-[#d5dcdc] bg-white px-3.5 py-2.5 text-base outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25"
        />
        <Btn type="submit" variant="light" disabled={!newCat.trim()}>Add category</Btn>
      </form>

      <Sheet open={!!draft} title={draft?.id ? "Edit item" : "New item"} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={saveItem} className="flex flex-col gap-3">
            <TextInput label="Name" required maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextArea label="Description" maxLength={400} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} hint="Only describe what you offer. Skip health or result claims." />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Price (₹)" inputMode="decimal" disabled={draft.price_on_request} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              <TextInput label="Prefix" placeholder="from" maxLength={12} value={draft.price_prefix ?? ""} onChange={(e) => setDraft({ ...draft, price_prefix: e.target.value || null })} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.price_on_request} onChange={(e) => setDraft({ ...draft, price_on_request: e.target.checked })} /> Price on request
            </label>
            <TextInput label="Duration (minutes, optional)" inputMode="numeric" value={draft.duration_min ?? ""} onChange={(e) => setDraft({ ...draft, duration_min: e.target.value ? parseInt(e.target.value, 10) || null : null })} />
            <div>
              <p className="text-sm font-medium text-[#1a1e23] mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-2">
                {DIET.map(([k, l]) => {
                  const on = draft.dietary.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, dietary: on ? draft.dietary.filter((x) => x !== k) : [...draft.dietary, k] })}
                      className={`min-h-[40px] px-4 rounded-full text-sm font-semibold border ${on ? "bg-[#1f2429] text-white border-[#1f2429]" : "bg-white border-[#d5dcdc]"}`}>{l}</button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {draft.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photo_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <label className="btn-pill-light min-h-[44px] inline-flex items-center cursor-pointer">
                {uploading ? "Uploading…" : draft.photo_url ? "Change photo" : "Add photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {draft.photo_url && <button type="button" className="text-sm underline text-[#515a63]" onClick={() => setDraft({ ...draft, photo_url: null })}>Remove</button>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Available today</span>
              <Switch label="Available" checked={draft.available} onChange={(v) => setDraft({ ...draft, available: v })} />
            </div>
            {state.menu.length > 1 && (
              <label className="text-sm font-medium text-[#1a1e23]">
                Category
                <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} className="mt-1 w-full rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5">
                  {state.menu.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {error && <p className="text-sm text-[#c62445]" role="alert">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" busy={busy} className="flex-1">Save</Btn>
              {draft.id && (
                <Btn
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (!confirmDel) { setConfirmDel(true); return; }
                    try { await api.deleteItem(draft.id!); setDraft(null); await reload(); toast("Item deleted"); } catch (err) { fail(err); }
                  }}
                >{confirmDel ? "Tap again to delete" : "Delete"}</Btn>
              )}
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
