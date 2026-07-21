"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { Btn, TextArea, TextInput } from "@/components/ui/kit";
import { HubApiError, formatMoney, growthApi, type PrintKitOrder } from "@/lib/hub/api";
import { CheckoutCancelled, runCheckout } from "@/lib/signup/checkout";

const STATUS: Record<string, string> = {
  requested: "Requested",
  paid: "Paid",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Print your own (the downloads above), or have the kit delivered to the shop
// for a flat fee.
export function PrintKitCard() {
  const [info, setInfo] = useState<{ delivery_fee_minor: number; currency_code: string; orders: PrintKitOrder[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    growthApi.printKit().then(setInfo).catch(() => {});
  }, []);

  if (!info) return null;
  const pending = info.orders.find((o) => o.method === "deliver" && ["requested", "paid", "shipped"].includes(o.status));

  async function payNow(o: PrintKitOrder) {
    setBusy(true);
    setError(null);
    try {
      const checkout = await growthApi.payPrintKit(o.id);
      const r = await runCheckout(checkout, "Print kit");
      await growthApi.confirmPrintKitPayment(o.id, {
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_order_id: r.razorpay_order_id ?? checkout.order_id ?? "",
        razorpay_signature: r.razorpay_signature,
      });
      setInfo(await growthApi.printKit());
    } catch (err) {
      if (!(err instanceof CheckoutCancelled))
        setError(err instanceof HubApiError ? err.message : "The payment didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  async function order(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await growthApi.orderPrintKit({ method: "deliver", address, phone });
      setInfo(await growthApi.printKit());
      setOpen(false);
    } catch (err) {
      setError(err instanceof HubApiError ? err.message : "Couldn't place the order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Get it printed and delivered" description="Prefer not to print? We can deliver a ready-to-use kit to your shop.">
      {pending ? (
        <div>
          <p className="text-sm text-ink">
            Your delivery request is <span className="font-semibold">{STATUS[pending.status]}</span>. We&rsquo;ll call {pending.phone} to confirm.
          </p>
          {pending.status === "requested" && (
            <div className="mt-3">
              {error && <p className="text-sm text-alert mb-2" role="alert">{error}</p>}
              <Btn busy={busy} onClick={() => payNow(pending)}>Pay {formatMoney(pending.fee_minor, pending.currency_code)} now</Btn>
              <p className="text-xs text-text-2 mt-2">Or pay when we call to confirm.</p>
            </div>
          )}
        </div>
      ) : open ? (
        <form onSubmit={order} className="flex flex-col gap-3">
          <TextArea label="Delivery address" required maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
          <TextInput label="Phone number" type="tel" required maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="text-sm text-text-2">
            Delivery fee: <span className="font-semibold text-ink">{formatMoney(info.delivery_fee_minor, info.currency_code)}</span>. You can pay right after you request it.
          </p>
          {error && <p className="text-sm text-alert" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Btn type="submit" busy={busy}>Request delivery</Btn>
            <Btn type="button" variant="light" onClick={() => setOpen(false)}>Cancel</Btn>
          </div>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-text-2">Delivered to your shop for {formatMoney(info.delivery_fee_minor, info.currency_code)}. Or use the free downloads above and print it yourself.</p>
          <Btn onClick={() => setOpen(true)}>Deliver to my shop</Btn>
        </div>
      )}
    </Card>
  );
}
