/** ₹499 from 49900 paise. Whole units drop the decimals. */
export function formatMoney(amountMinor: number, currency = "INR"): string {
  const value = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
