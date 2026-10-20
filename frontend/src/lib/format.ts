/**
 * ₹499 from 49900 paise, $19 from 1900 cents. Whole units drop the decimals.
 * `locale` is the outlet's / visitor's locale (e.g. "de-DE"); without one, INR
 * keeps Indian digit grouping and everything else uses en-US. Never the
 * browser's own locale, so server and client render the same text.
 */
export function formatMoney(amountMinor: number, currency = "INR", locale?: string): string {
  const loc = locale ?? (currency === "INR" ? "en-IN" : "en-US");
  // Minor-unit exponent comes from the currency (JPY has none, KWD has three).
  const digits = new Intl.NumberFormat(loc, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const value = amountMinor / 10 ** digits;
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : digits,
  }).format(value);
}

export function formatDate(iso: string, locale = "en-IN"): string {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
