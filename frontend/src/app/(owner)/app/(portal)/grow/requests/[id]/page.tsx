"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { Btn, TextArea } from "@/components/ui/kit";
import { HubApiError, formatMoney, growthApi, type ServiceRequest } from "@/lib/hub/api";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";

const STEPS = ["requested", "quoted", "accepted", "in_progress", "delivered"];
const LABEL: Record<string, string> = {
  requested: "Requested", quoted: "Quote ready", accepted: "Accepted", in_progress: "In progress",
  delivered: "Delivered", declined: "Declined", cancelled: "Cancelled",
};

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<ServiceRequest | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    growthApi.request(id).then(setReq).catch(() => setReq(null));
  }, [id]);

  async function run(fn: () => Promise<ServiceRequest>) {
    setBusy(true);
    setError(null);
    try {
      setReq(await fn());
      setMsg("");
    } catch (e) {
      setError(e instanceof HubApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const info = await growthApi.payRequest(req.id);
      const r = await runCheckout(info, req.service_name);
      setReq(
        await growthApi.confirmRequestPayment(req.id, {
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_order_id: r.razorpay_order_id ?? info.order_id ?? "",
          razorpay_signature: r.razorpay_signature,
        })
      );
    } catch (e) {
      if (!(e instanceof CheckoutCancelled))
        setError(e instanceof HubApiError ? e.message : "The payment didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (req === undefined) return <div className="ui-skeleton h-64 rounded-2xl" />;
  if (req === null) return <p className="text-sm text-text-2">Request not found. <Link className="underline" href="/app/grow">Back</Link></p>;

  const step = STEPS.indexOf(req.status);
  const closed = step === -1;

  return (
    <>
      <Link href="/app/grow" className="text-sm font-semibold text-text-2 min-h-[44px] inline-flex items-center">← All services</Link>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink">{req.service_name}</h1>
        <p className="text-sm text-text-2 mt-1">Requested {new Date(req.created_at).toLocaleDateString()}</p>
      </div>

      <Card>
        {closed ? (
          <p className="font-semibold text-ink">{LABEL[req.status]}</p>
        ) : (
          <ol className="grid grid-cols-5 gap-1" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined} className="text-center">
                <span className={`block h-1.5 rounded-full ${i <= step ? "bg-[#2f68db]" : "bg-line"}`} />
                <span className={`block mt-1.5 text-[11px] leading-tight ${i === step ? "font-bold text-ink" : "text-text-2"}`}>{LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {req.status === "quoted" && req.quoted_amount_minor !== null && (
        <Card title="Your quote">
          <p className="text-3xl font-bold text-ink">{formatMoney(req.quoted_amount_minor, req.currency_code)}</p>
          <p className="text-sm text-text-2 mt-1">Accept to confirm. We&rsquo;ll then get in touch to arrange payment and start work.</p>
          {error && <p className="text-sm text-alert mt-2" role="alert">{error}</p>}
          <div className="flex gap-2 mt-4">
            <Btn busy={busy} onClick={() => run(() => growthApi.accept(req.id))}>Accept quote</Btn>
            <Btn variant="light" disabled={busy} onClick={() => run(() => growthApi.cancel(req.id))}>Not now</Btn>
          </div>
        </Card>
      )}

      {["accepted", "in_progress"].includes(req.status) && req.quoted_amount_minor !== null && (
        <Card title={req.paid ? "Payment received" : "Payment"}>
          {req.paid ? (
            <p className="text-sm text-ink">Thank you. We&rsquo;ve received {formatMoney(req.quoted_amount_minor, req.currency_code)} and work is under way.</p>
          ) : (
            <>
              <p className="text-sm text-text-2">Pay the agreed amount securely to start work.</p>
              <p className="text-2xl font-bold text-ink mt-2">{formatMoney(req.quoted_amount_minor, req.currency_code)}</p>
              {error && <p className="text-sm text-alert mt-2" role="alert">{error}</p>}
              <Btn className="mt-3" busy={busy} onClick={pay}>Pay now</Btn>
            </>
          )}
        </Card>
      )}

      <Card title="Conversation">
        <ul className="flex flex-col gap-3">
          {(req.events ?? []).map((e) =>
            e.kind === "status_changed" ? (
              <li key={e.id} className="text-xs text-text-2 text-center">{e.body} · {new Date(e.created_at).toLocaleDateString()}</li>
            ) : (
              <li key={e.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${e.actor === "owner" ? "self-end bg-[#2f68db] text-white" : "self-start bg-paper-subtle text-ink"}`}>
                {e.body}
              </li>
            )
          )}
        </ul>
        {!closed && (
          <form className="mt-4 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) run(() => growthApi.message(req.id, msg.trim())); }}>
            <TextArea label="Message the team" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
            <Btn type="submit" variant="light" busy={busy} disabled={!msg.trim()} className="self-start">Send</Btn>
          </form>
        )}
      </Card>

      {!closed && ["requested"].includes(req.status) && (
        <button className="text-sm text-text-2 underline self-start min-h-[44px]" onClick={() => run(() => growthApi.cancel(req.id))}>Cancel this request</button>
      )}
    </>
  );
}
