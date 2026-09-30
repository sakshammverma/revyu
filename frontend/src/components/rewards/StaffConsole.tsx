"use client";

import { useEffect, useRef, useState } from "react";

import {
  HubApiError,
  clearStaffToken,
  formatMoney,
  getStaffToken,
  staffLogin,
  staffLookup,
  staffRedeem,
  staffTransferCode,
  staffVisit,
  type Grant,
  type VisitResult,
} from "@/lib/hub/api";

type Member = { public_id: string; name: string };

// Camera scanning uses the browser BarcodeDetector where it exists (Chrome on
// Android); everywhere else staff type the code, which always works.
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const hasScanner = () => typeof window !== "undefined" && "BarcodeDetector" in window;

function Scanner({ onCode, onClose }: { onCode: (v: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const detector = new Ctor({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          const hit = found.find((f) => /^[A-Z0-9]{4}-\d{6}$/.test(f.rawValue));
          if (hit) onCode(hit.rawValue);
          else setTimeout(tick, 250);
        };
        tick();
      } catch {
        setErr("Camera unavailable. Type the code instead.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 p-4" role="dialog" aria-modal="true" aria-label="Scan customer code">
      <video ref={video} playsInline muted className="w-full max-w-sm rounded-2xl bg-black" />
      <p className="text-white text-sm" role={err ? "alert" : undefined}>{err ?? "Point the camera at the customer QR code"}</p>
      <button type="button" onClick={onClose} className="btn-pill-light min-h-[48px] px-8">Cancel</button>
    </div>
  );
}

function msg(e: unknown) {
  return e instanceof HubApiError ? e.message : "Something went wrong. Try again.";
}

function rewardLine(g: Grant) {
  if (g.type === "percent_discount" && g.percent) return `${g.percent}% off`;
  if (g.type === "amount_discount" && g.value_minor) return `${formatMoney(g.value_minor, g.currency_code)} off`;
  return g.type === "free_service" ? "Free service" : "Freebie";
}

function PinPad({ onSubmit, busy, error }: { onSubmit: (pin: string) => void; busy: boolean; error: string | null }) {
  const [pin, setPin] = useState("");
  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));
  return (
    <div className="v2-sheet border border-[#e8ecec] p-6 flex flex-col items-center gap-4">
      <h1 className="font-display text-xl text-[#1a1e23]">Staff sign in</h1>
      <div className="flex gap-2 h-4" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i < pin.length ? "bg-[#1a1e23]" : "bg-[#d5dcdc]"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[16rem]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="min-h-[60px] rounded-xl border border-[#d5dcdc] bg-white text-2xl font-semibold active:bg-[#f2f7f7]">{d}</button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete" className="min-h-[60px] rounded-xl text-[#515a63]">⌫</button>
        <button type="button" onClick={() => press("0")} className="min-h-[60px] rounded-xl border border-[#d5dcdc] bg-white text-2xl font-semibold active:bg-[#f2f7f7]">0</button>
        <button type="button" disabled={pin.length < 4 || busy} onClick={() => onSubmit(pin)} className="min-h-[60px] rounded-xl bg-[#2f68db] text-white font-semibold disabled:opacity-40">Go</button>
      </div>
      {error && <p className="text-sm text-[#c62445]" role="alert">{error}</p>}
    </div>
  );
}

export function StaffConsole({ slug }: { slug: string }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VisitResult | null>(null);
  const [lookup, setLookup] = useState<{ member: Member; visits: number; pending_rewards: Grant[] } | null>(null);
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [transfer, setTransfer] = useState<{ code: string; valid_minutes: number } | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with external/async source on mount
  useEffect(() => setAuthed(!!getStaffToken(slug)), [slug]);

  function expire(e: unknown) {
    if (e instanceof HubApiError && e.status === 401) {
      clearStaffToken(slug);
      setAuthed(false);
    }
    setError(msg(e));
  }

  async function login(pin: string) {
    setBusy(true);
    setError(null);
    try {
      setLabel((await staffLogin(slug, pin)).label);
      setAuthed(true);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function record() {
    setBusy(true);
    setError(null);
    setRedeemed(null);
    setLookup(null);
    setTransfer(null);
    try {
      setResult(await staffVisit(slug, code));
      setCode("");
    } catch (e) {
      setResult(null);
      expire(e);
    } finally {
      setBusy(false);
    }
  }

  async function find() {
    setBusy(true);
    setError(null);
    setResult(null);
    setRedeemed(null);
    try {
      setLookup(await staffLookup(slug, code.split("-")[0]));
    } catch (e) {
      setLookup(null);
      expire(e);
    } finally {
      setBusy(false);
    }
  }

  async function redeem(g: Grant) {
    setBusy(true);
    setError(null);
    try {
      const r = await staffRedeem(slug, g.redeem_code);
      setRedeemed(`${r.title} redeemed for ${r.member}`);
      setResult((cur) => (cur ? { ...cur, pending_rewards: cur.pending_rewards.filter((x) => x.id !== g.id) } : cur));
      setLookup((cur) => (cur ? { ...cur, pending_rewards: cur.pending_rewards.filter((x) => x.id !== g.id) } : cur));
    } catch (e) {
      expire(e);
    } finally {
      setBusy(false);
    }
  }

  function onScanned(v: string) {
    setScanning(false);
    setCode(v);
  }

  if (authed === null) return <div className="ui-skeleton h-64 rounded-2xl" />;
  if (!authed) return <PinPad onSubmit={login} busy={busy} error={error} />;

  const pending = result?.pending_rewards.filter((g) => g.status === "available") ?? lookup?.pending_rewards ?? [];
  const member = result?.member ?? lookup?.member;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl text-[#1a1e23]">Counter{label ? ` · ${label}` : ""}</h1>
        <button type="button" onClick={() => { clearStaffToken(slug); setAuthed(false); }} className="text-sm text-[#515a63] underline min-h-[44px]">Sign out</button>
      </header>

      <div className="v2-sheet border border-[#e8ecec] p-4 flex flex-col gap-3">
        <label className="text-sm font-medium text-[#1a1e23]" htmlFor="visit-code">Customer code</label>
        <input
          id="visit-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A7F3-123456"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          className="w-full rounded-xl border border-[#d5dcdc] px-4 py-4 text-2xl font-mono tracking-widest text-center outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25"
        />
        {hasScanner() && (
          <button type="button" onClick={() => setScanning(true)} className="btn-pill-light min-h-[48px]">Scan QR code</button>
        )}
        <button type="button" disabled={busy || code.length < 8} onClick={record} className="btn-primary min-h-[52px] disabled:opacity-40">Record visit</button>
        <button type="button" disabled={busy || code.length < 4} onClick={find} className="btn-pill-light min-h-[44px] disabled:opacity-40">Look up member to redeem</button>
      </div>

      {error && <p className="text-sm text-[#c62445] px-1" role="alert">{error}</p>}
      {redeemed && <p className="text-sm font-semibold text-[#2f7a16] px-1" role="status">✓ {redeemed}</p>}

      {scanning && <Scanner onCode={onScanned} onClose={() => setScanning(false)} />}

      {member && (
        <section className="v2-sheet border border-[#e8ecec] p-5" aria-live="polite">
          {result && <p className="text-3xl text-[#2f7a16]" aria-hidden="true">✓</p>}
          <p className="font-semibold text-lg text-[#1a1e23]">{member.name} <span className="text-[#59636a] font-normal">· {member.public_id}</span></p>
          <p className="text-sm text-[#515a63]">
            {result ? `Visit recorded · ${result.visits} total` : `${lookup?.visits ?? 0} visits`}
          </p>
          {result && result.badges_earned.length > 0 && (
            <p className="mt-2 text-sm font-semibold text-[#2f68db]">New badge: {result.badges_earned.join(", ")}</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              try { setTransfer(await staffTransferCode(slug, member.public_id)); } catch (e) { expire(e); }
            }}
            className="mt-3 text-sm text-[#515a63] underline min-h-[44px]"
          >
            Customer changed phone? Get a transfer code
          </button>
          {transfer && (
            <p className="mt-1 text-sm" role="status">
              Give them <span className="font-mono text-xl font-bold tracking-widest">{transfer.code}</span> · valid {transfer.valid_minutes} min
            </p>
          )}
          {pending.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {pending.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#d5dcdc] p-3">
                  <span className="min-w-0 text-sm"><span className="block font-semibold text-[#1a1e23]">{g.title}</span><span className="text-[#59636a]">{rewardLine(g)}</span></span>
                  <button type="button" disabled={busy} onClick={() => redeem(g)} className="btn-primary min-h-[44px] px-4 shrink-0">Redeem</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#59636a]">No rewards waiting.</p>
          )}
        </section>
      )}
    </div>
  );
}
