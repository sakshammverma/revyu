"use client";

import { useState } from "react";

import { AdminTokenGate } from "@/components/admin/AdminTokenGate";
import {
  approveOutlet,
  fetchApprovalQueue,
  rejectOutlet,
  requestInfo,
  type ApprovalQueueItem,
} from "@/lib/admin/api";
import { useAsync } from "@/lib/useAsync";

export function ApprovalQueue() {
  return (
    <AdminTokenGate>
      <Queue />
    </AdminTokenGate>
  );
}

function Queue() {
  const { data, error, loading, reload } = useAsync(fetchApprovalQueue);
  const items: ApprovalQueueItem[] = data ?? [];
  const load = reload;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-5">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#dfe5e5]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">Pending Outlets</span>
          <span className="text-xs tabular-nums px-2.5 py-0.5 rounded-full bg-accent-50 border border-accent/20 text-accent-hover font-semibold">
            {items.length} in queue
          </span>
        </div>
        <button
          onClick={load}
          className="btn-pill-light border border-line text-xs"
        >
          ↻ Refresh
        </button>
      </div>

      {error != null && (
        <div role="alert" className="p-3.5 rounded-xl bg-alert-50 border border-alert/25 text-alert text-sm">
          Failed to load queue. Check your connection and refresh.
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-text-2">
          Loading verification queue…
        </div>
      )}

      {!loading && error == null && items.length === 0 && (
        <div className="v2-sheet border border-line p-8 sm:p-10 text-center text-text-2 text-sm">
          ✓ Verification queue is empty. All outlets reviewed.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <QueueRow key={item.outlet_id} item={item} onDone={load} />
        ))}
      </div>
    </div>
  );
}

function QueueRow({ item, onDone }: { item: ApprovalQueueItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [placeVerified, setPlaceVerified] = useState(false);
  const [placementConfirmed, setPlacementConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const canApprove = placeVerified && placementConfirmed;

  async function handleApprove() {
    if (!canApprove) return;
    setBusy(true);
    setActionError(null);
    try {
      // SRS-19.3: exactly what the founder ticked, never a default.
      await approveOutlet(item.outlet_id, { place_verified: placeVerified, placement_confirmed: placementConfirmed });
      onDone();
    } catch {
      setActionError("Approval failed. Nothing changed, so you can try again.");
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      await rejectOutlet(item.outlet_id, rejectReason);
      onDone();
    } catch {
      setActionError("Rejection failed. Nothing changed, so you can try again.");
      setBusy(false);
    }
  }

  async function handleRequestInfo() {
    if (!infoMessage.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await requestInfo(item.outlet_id, infoMessage.trim());
      onDone();
    } catch {
      setActionError("Couldn't send that request. Please try again.");
      setBusy(false);
    }
  }

  const isAgedOut = item.age_hours > 24;

  return (
    <div
      className={`v2-sheet p-4 sm:p-6 border transition-colors ${
        isAgedOut ? "border-alert/50 ring-1 ring-[#c62445]/15" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-line gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide font-semibold text-accent-hover bg-accent-50 border border-accent/20 px-2.5 py-0.5 rounded-full">
            {item.vertical}
          </span>
          <span className="text-xs tabular-nums text-text-2">
            Submitted {item.age_hours}h ago
          </span>
        </div>
        {isAgedOut && (
          <span className="text-xs uppercase tracking-wide text-alert bg-alert-50 border border-alert/25 px-2.5 py-0.5 rounded-full font-bold">
            Over 24h SLA
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
        <div className="p-1 md:py-4">
          <p className="text-[11px] uppercase tracking-wider text-text-2 font-semibold">
            Submitted by Owner
          </p>
          <p className="font-display text-xl text-ink mt-1">{item.business_name}</p>
          <p className="text-sm text-text-2 mt-1.5 leading-relaxed break-words">
            {item.owner.name} · {item.owner.phone} · {item.owner.email}
          </p>
        </div>

        <div className="rounded-xl bg-[#f5f9ff] border border-accent/25 p-4">
          <p className="text-[11px] uppercase tracking-wider text-accent font-semibold">
            Matched Google Business Profile
          </p>
          <p className="font-display text-xl sm:text-2xl text-ink mt-1">{item.google_match.name}</p>
          <p className="text-sm sm:text-base font-medium text-ink mt-1.5 leading-relaxed">
            {item.google_match.address ?? "Address unavailable — manual verification required"}
          </p>
          {item.google_match.rating !== null && (
            <p className="text-sm tabular-nums text-ink mt-2 flex items-center gap-2">
              <span className="text-amber-700 font-bold">★ {item.google_match.rating}</span>
              <span className="text-text-2">({item.google_match.review_count} reviews)</span>
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-4 pt-4 border-t border-line">
        <legend className="text-xs uppercase tracking-wider text-text-2 font-semibold mb-2">
          Both checks are required to approve
        </legend>
        <label className="flex items-start gap-3 min-h-[44px] py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={placeVerified}
            onChange={(e) => setPlaceVerified(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#2f6df0]"
          />
          <span className="text-sm text-ink">
            <strong>Place verified.</strong> The Google listing above is this business (name, address and photos match).
          </span>
        </label>
        <label className="flex items-start gap-3 min-h-[44px] py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={placementConfirmed}
            onChange={(e) => setPlacementConfirmed(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#2f6df0]"
          />
          <span className="text-sm text-ink">
            <strong>Placement confirmed.</strong> The owner agreed to printed placement only: no tablet, no staff watching.
          </span>
        </label>
      </fieldset>

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-alert">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-line">
        <a
          href={item.preview_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1"
        >
          <span>Preview customer review QR flow</span>
          <span>↗</span>
        </a>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || !canApprove}
            onClick={handleApprove}
            title={canApprove ? undefined : "Tick both checks first"}
            className="btn-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Approve outlet
          </button>
          <button
            disabled={busy}
            onClick={() => setShowInfo(!showInfo)}
            className="btn-pill-light min-h-[44px] border border-line disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request info
          </button>
          <button
            disabled={busy}
            onClick={() => setShowReject(!showReject)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-alert-50 text-alert border border-alert/40 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mt-4 p-3 sm:p-4 rounded-xl bg-[#f5f9ff] border border-accent/25 flex flex-col sm:flex-row gap-2">
          <input
            aria-label="What do you need from the owner?"
            className="flex-1 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-[#2f6df0] focus:ring-2 focus:ring-[#2f6df0]/20"
            placeholder="What do you need from the owner? They get this by email."
            value={infoMessage}
            onChange={(e) => setInfoMessage(e.target.value)}
          />
          <button
            disabled={busy || !infoMessage.trim()}
            onClick={handleRequestInfo}
            className="btn-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send request
          </button>
        </div>
      )}

      {showReject && (
        <div className="mt-4 p-3 sm:p-4 rounded-xl bg-alert-50/60 border border-alert/25 flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-alert focus:ring-2 focus:ring-[#c62445]/20"
            placeholder="Reason for rejection (triggers automatic refund notification)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button
            disabled={busy || !rejectReason.trim()}
            onClick={handleReject}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#c62445] text-white text-sm font-semibold hover:bg-[#a51d38] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm Rejection
          </button>
        </div>
      )}
    </div>
  );
}
