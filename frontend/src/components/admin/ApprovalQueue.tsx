"use client";

import { useEffect, useId, useState } from "react";
import {
  approveOutlet,
  fetchApprovalQueue,
  getAdminToken,
  rejectOutlet,
  requestInfo,
  setAdminToken,
  type ApprovalQueueItem,
} from "@/lib/admin/api";

export function ApprovalQueue() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalQueue();
      setItems(data);
    } catch {
      setError("Failed to load queue. Check your admin token.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const tokenInputId = useId();

  if (!token) {
    return (
      <div className="v2-sheet border border-[#e8ecec] p-6 sm:p-8 max-w-md mx-auto">
        <label htmlFor={tokenInputId} className="block text-sm font-semibold text-[#1a1e23] mb-2">
          Admin Secret Token
        </label>
        <input
          id={tokenInputId}
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter token to view queue"
          className="w-full rounded-lg border border-[#d5dcdc] bg-white px-3.5 py-3 text-base text-[#1a1e23] outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25 transition-colors"
        />
        <button
          className="btn-primary mt-4 w-full min-h-[44px]"
          onClick={() => {
            setAdminToken(tokenInput);
            setToken(tokenInput);
          }}
        >
          Access Queue →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-5">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#dfe5e5]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#1a1e23]">Pending Outlets</span>
          <span className="text-xs tabular-nums px-2.5 py-0.5 rounded-full bg-[#e7f5fd] border border-[#397dff]/20 text-[#2f68db] font-semibold">
            {items.length} in queue
          </span>
        </div>
        <button
          onClick={load}
          className="btn-pill-light border border-[#e8ecec] text-xs"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#fdf2f4] border border-[#c62445]/25 text-[#c62445] text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-[#515a63]">
          Loading verification queue…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="v2-sheet border border-[#e8ecec] p-8 sm:p-10 text-center text-[#515a63] text-sm">
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
        isAgedOut ? "border-[#c62445]/50 ring-1 ring-[#c62445]/15" : "border-[#e8ecec]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#e8ecec] gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide font-semibold text-[#2f68db] bg-[#e7f5fd] border border-[#397dff]/20 px-2.5 py-0.5 rounded-full">
            {item.vertical}
          </span>
          <span className="text-xs tabular-nums text-[#515a63]">
            Submitted {item.age_hours}h ago
          </span>
        </div>
        {isAgedOut && (
          <span className="text-xs uppercase tracking-wide text-[#c62445] bg-[#fdf2f4] border border-[#c62445]/25 px-2.5 py-0.5 rounded-full font-bold">
            Over 24h SLA
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
        <div className="p-1 md:py-4">
          <p className="text-[11px] uppercase tracking-wider text-[#515a63] font-semibold">
            Submitted by Owner
          </p>
          <p className="font-display text-xl text-[#1a1e23] mt-1">{item.business_name}</p>
          <p className="text-sm text-[#515a63] mt-1.5 leading-relaxed break-words">
            {item.owner.name} · {item.owner.phone} · {item.owner.email}
          </p>
        </div>

        <div className="rounded-xl bg-[#f5f9ff] border border-[#397dff]/25 p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#2f68db] font-semibold">
            Matched Google Business Profile
          </p>
          <p className="font-display text-xl sm:text-2xl text-[#1a1e23] mt-1">{item.google_match.name}</p>
          <p className="text-sm sm:text-base font-medium text-[#1a1e23] mt-1.5 leading-relaxed">
            {item.google_match.address ?? "Address unavailable — manual verification required"}
          </p>
          {item.google_match.rating !== null && (
            <p className="text-sm tabular-nums text-[#1a1e23] mt-2 flex items-center gap-2">
              <span className="text-amber-700 font-bold">★ {item.google_match.rating}</span>
              <span className="text-[#515a63]">({item.google_match.review_count} reviews)</span>
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-4 pt-4 border-t border-[#e8ecec]">
        <legend className="text-xs uppercase tracking-wider text-[#515a63] font-semibold mb-2">
          Both checks are required to approve
        </legend>
        <label className="flex items-start gap-3 min-h-[44px] py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={placeVerified}
            onChange={(e) => setPlaceVerified(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#2f6df0]"
          />
          <span className="text-sm text-[#1a1e23]">
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
          <span className="text-sm text-[#1a1e23]">
            <strong>Placement confirmed.</strong> The owner agreed to printed placement only: no tablet, no staff watching.
          </span>
        </label>
      </fieldset>

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-[#c62445]">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#e8ecec]">
        <a
          href={item.preview_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[#2f68db] hover:underline inline-flex items-center gap-1"
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
            className="btn-pill-light min-h-[44px] border border-[#e8ecec] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request info
          </button>
          <button
            disabled={busy}
            onClick={() => setShowReject(!showReject)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#fdf2f4] text-[#c62445] border border-[#c62445]/40 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mt-4 p-3 sm:p-4 rounded-xl bg-[#f5f9ff] border border-[#397dff]/25 flex flex-col sm:flex-row gap-2">
          <input
            aria-label="What do you need from the owner?"
            className="flex-1 rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm text-[#1a1e23] outline-none focus:border-[#2f6df0] focus:ring-2 focus:ring-[#2f6df0]/20"
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
        <div className="mt-4 p-3 sm:p-4 rounded-xl bg-[#fdf2f4]/60 border border-[#c62445]/25 flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 rounded-lg border border-[#d5dcdc] bg-white px-3 py-2.5 text-sm text-[#1a1e23] outline-none focus:border-[#c62445] focus:ring-2 focus:ring-[#c62445]/20"
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
