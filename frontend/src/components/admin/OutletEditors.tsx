"use client";

// Admin editors for one outlet, shown under "Admin controls" on the customer profile.

import { useState } from "react";

import { Button, Card, Field, useToast } from "@/components/ui";
import { overrideOutletState, updateOutletTags, type OutletDetail } from "@/lib/admin/api";

const STATES = ["trial", "locked", "active", "past_due", "suspended", "deactivated"];

export function StateOverride({ detail, onDone }: { detail: OutletDetail; onDone: () => void }) {
  const { toast } = useToast();
  const [state, setState] = useState(detail.state);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      await overrideOutletState(detail.id, state, reason.trim());
      toast(`State set to ${state}`);
      setConfirming(false);
      setReason("");
      onDone();
    } catch {
      toast("Couldn't change the state.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const changed = state !== detail.state;

  return (
    <Card title="Manual state override" description="For comping a pilot or pausing an outlet. The reason is logged.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="override-state" className="text-sm font-semibold text-ink">
            New state
          </label>
          <select
            id="override-state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setConfirming(false);
            }}
            className="min-h-[44px] rounded-[var(--r-control)] border border-line-strong bg-sheet px-3 text-base text-ink"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. comped for pilot" />
        {!confirming ? (
          <Button variant="secondary" disabled={!changed || reason.trim().length < 3} onClick={() => setConfirming(true)}>
            Review change
          </Button>
        ) : (
          <div role="alert" className="rounded-xl border border-warning/30 bg-warning-50 p-3 text-sm">
            <p className="text-ink">
              Change <strong>{detail.business_name}</strong> from <strong>{detail.state}</strong> to <strong>{state}</strong>? This takes effect immediately.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={apply} loading={busy}>
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

type TagRow = { id: string | null; label: string; phrases: string; active: boolean };

export function TagEditor({ detail, onSaved }: { detail: OutletDetail; onSaved: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<TagRow[]>(
    detail.tags.map((t) => ({ id: t.id, label: t.label, phrases: t.phrases.join("\n"), active: t.active }))
  );
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<TagRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const invalid = rows.some(
    (r) => r.active && (!r.label.trim() || r.phrases.split("\n").filter((p) => p.trim()).length < 1)
  );

  async function save() {
    setBusy(true);
    try {
      await updateOutletTags(
        detail.id,
        rows.map((r, i) => ({
          id: r.id ?? undefined,
          label: r.label.trim(),
          phrases: r.phrases.split("\n").map((p) => p.trim()).filter(Boolean),
          sort_order: i,
          active: r.active,
        }))
      );
      toast("Tags saved");
      onSaved();
    } catch {
      toast("Couldn't save the tags.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Tags"
      description="Customers tap these, and the draft is built only from their phrases. Phrases are fragments (no sentences about the customer's visit), one per line."
      action={
        <Button onClick={save} loading={busy} disabled={invalid}>
          Save tags
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className={`rounded-xl border p-3 sm:p-4 ${r.active ? "border-line bg-sheet" : "border-line bg-paper-subtle/50 opacity-70"}`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label="Label" value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`phrases-${i}`} className="text-sm font-semibold text-ink">
                  Phrases
                </label>
                <textarea
                  id={`phrases-${i}`}
                  rows={3}
                  value={r.phrases}
                  onChange={(e) => update(i, { phrases: e.target.value })}
                  className="rounded-[var(--r-control)] border border-line-strong bg-sheet px-3.5 py-2.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>
            <label className="mt-2 inline-flex items-center gap-2 min-h-[44px] text-sm cursor-pointer">
              <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} className="w-5 h-5 accent-[#2f6df0]" />
              Shown to customers
            </label>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={() => setRows((r) => [...r, { id: null, label: "", phrases: "", active: true }])}
      >
        + Add tag
      </Button>
      {invalid && <p role="alert" className="text-sm text-alert mt-2">Every shown tag needs a label and at least one phrase.</p>}
    </Card>
  );
}
