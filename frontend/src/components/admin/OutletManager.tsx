"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import {
  activateOutlet,
  AdminApiError,
  bulkImportOutlets,
  createOutlet,
  fetchOutlets,
  fetchVerticals,
  type BulkImportRowResult,
  type OutletListItem,
} from "@/lib/admin/api";

// Rendered inside <AdminTokenGate>, which guarantees a token is already set.
export function OutletManager() {
  const [outlets, setOutlets] = useState<OutletListItem[]>([]);
  const [verticals, setVerticals] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [items, verts] = await Promise.all([
        fetchOutlets({ state: stateFilter || undefined }),
        fetchVerticals(),
      ]);
      setOutlets(items);
      setVerticals(verts);
    } catch {
      // AdminTokenGate handles the auth-failure path; a transient fetch
      // error here just leaves the list empty rather than crashing.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#dfe5e5]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#1a1e23]">Outlets</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-lg border border-[#d5dcdc] bg-white px-3 py-1.5 text-sm text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25"
          >
            <option value="">All states</option>
            {["draft", "pending_approval", "trial", "locked", "active", "past_due", "suspended", "rejected", "deactivated"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="btn-pill-light min-h-[38px] border border-[#e8ecec] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bulk import
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + New outlet
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateOutletForm verticals={verticals} onDone={() => { setShowCreate(false); load(); }} />
      )}
      {showBulk && <BulkImportForm onDone={() => { setShowBulk(false); load(); }} />}

      {loading && <p className="text-sm text-[#515a63]">Loading…</p>}
      {!loading && outlets.length === 0 && (
        <p className="text-sm text-[#515a63]">No outlets match this filter.</p>
      )}

      <div className="flex flex-col gap-2">
        {outlets.map((o) => (
          <OutletRow key={o.outlet_id} outlet={o} onDone={load} />
        ))}
      </div>
    </div>
  );
}

function OutletRow({ outlet, onDone }: { outlet: OutletListItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setBusy(true);
    setError(null);
    try {
      await activateOutlet(outlet.outlet_id);
      onDone();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.code : "Activation failed");
      setBusy(false);
    }
  }

  return (
    <div className="v2-sheet border border-[#e8ecec] px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <a href={`/admin/outlets/${outlet.outlet_id}/detail`} className="text-base font-semibold text-[#1a1e23] truncate hover:text-[#2f68db] hover:underline block">{outlet.business_name}</a>
        <p className="text-xs font-mono text-[#515a63] mt-0.5">
          {outlet.vertical} · {outlet.state} · {outlet.source}
        </p>
        {error && <p className="text-xs text-[#c62445] mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
      <Link
        href={`/admin/outlets/${outlet.outlet_id}`}
        className="btn-pill-light min-h-[38px] inline-flex items-center text-sm"
      >
        QR page
      </Link>
      {(outlet.state === "draft" || outlet.state === "pending_approval") && (
        <button
          disabled={busy}
          onClick={handleActivate}
          className="btn-primary min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          Activate
        </button>
      )}
      </div>
    </div>
  );
}

function CreateOutletForm({ verticals, onDone }: { verticals: string[]; onDone: () => void }) {
  const businessId = useId();
  const phoneId = useId();
  const emailId = useId();
  const mapsId = useId();

  const [businessName, setBusinessName] = useState("");
  const [vertical, setVertical] = useState(verticals[0] ?? "dental");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await createOutlet({
        business_name: businessName,
        vertical,
        owner_phone: ownerPhone,
        owner_email: ownerEmail,
        google_maps_url: mapsUrl || undefined,
      });
      onDone();
    } catch (e) {
      if (e instanceof AdminApiError && e.code === "AMBIGUOUS_PLACE") {
        setError(
          `Ambiguous match — ${e.candidates?.length ?? 0} candidates found. Resolve manually with a raw Place ID.`
        );
      } else {
        setError(e instanceof AdminApiError ? e.code : "Creation failed");
      }
      setBusy(false);
    }
  }

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6 flex flex-col gap-4">
      <p className="font-display text-xl text-[#1a1e23]">New outlet</p>
      {error && <p className="px-3 py-2 rounded-lg bg-[#fdf2f4] border border-[#c62445]/20 text-sm text-[#c62445]">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field id={businessId} label="Business name" value={businessName} onChange={setBusinessName} />
        <div>
          <label className="text-xs font-semibold text-[#515a63]">Vertical</label>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25 transition-colors"
          >
            {verticals.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Field id={phoneId} label="Owner phone" value={ownerPhone} onChange={setOwnerPhone} />
        <Field id={emailId} label="Owner email" value={ownerEmail} onChange={setOwnerEmail} type="email" />
        <div className="md:col-span-2">
          <Field
            id={mapsId}
            label="Google Maps link (or paste a raw Place ID)"
            value={mapsUrl}
            onChange={setMapsUrl}
          />
        </div>
      </div>

      <button
        disabled={busy || !businessName || !ownerPhone || !ownerEmail}
        onClick={handleSubmit}
        className="btn-primary min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed self-start"
      >
        {busy ? "Creating…" : "Create outlet"}
      </button>
    </div>
  );
}

function BulkImportForm({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; rows: BulkImportRowResult[] } | null>(null);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await bulkImportOutlets(file);
      setResult(res);
      if (res.failed === 0) setTimeout(onDone, 1500);
    } catch {
      setResult({ created: 0, failed: 0, rows: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="v2-sheet border border-[#e8ecec] p-4 sm:p-6 flex flex-col gap-4">
      <p className="font-display text-xl text-[#1a1e23]">Bulk import (CSV)</p>
      <p className="text-sm text-[#515a63] leading-relaxed">
        Columns: business_name, vertical, owner_phone, owner_email, google_maps_url. All rows
        land in <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#f2f7f7] border border-[#e8ecec] text-[#1a1e23]">draft</span> — activate individually.
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-[#515a63] file:mr-3 file:rounded-lg file:border file:border-[#e8ecec] file:bg-[#f2f7f7] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#1a1e23] hover:file:bg-[#e5ecec] file:cursor-pointer"
      />
      <button
        disabled={busy || !file}
        onClick={handleImport}
        className="btn-primary min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed self-start"
      >
        {busy ? "Importing…" : "Import"}
      </button>

      {result && (
        <div className="mt-1 p-3 rounded-lg bg-[#f7fafa] border border-[#e8ecec] text-sm text-[#1a1e23]">
          <p>
            Created: <span className="font-semibold tabular-nums text-[#2f6b1a]">{result.created}</span> · Failed:{" "}
            <span className="font-semibold tabular-nums text-[#c62445]">{result.failed}</span>
          </p>
          {result.rows.filter((r) => r.status === "error").length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {result.rows
                .filter((r) => r.status === "error")
                .map((r) => (
                  <li key={r.row} className="text-[#c62445] font-mono text-xs">
                    Row {r.row}: {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-[#515a63]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25 transition-colors"
      />
    </div>
  );
}
