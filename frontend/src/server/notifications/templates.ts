/**
 * Email copy for every notification template. Port of
 * backend/app/services/notifications/templates.py - keep the wording in sync
 * until the Python backend is retired.
 */

export const TEMPLATES = [
  "otp_login",
  "outlet_activated",
  "first_scan",
  "trial_threshold",
  "private_feedback_received",
  "weekly_digest",
  "payment_failed",
  "needs_info",
  "signup_rejected",
  "trial_reminder",
  "credits_low",
  "collection_paused",
  "zero_scan_nudge",
  "gap_report",
  "service_update",
] as const;

export type Template = (typeof TEMPLATES)[number];
export type TemplateData = Record<string, unknown>;

/** Python f-string style rendering: missing values print as empty / fallback. */
const s = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const d = (v: unknown, fallback: string | number): string =>
  v === undefined || v === null ? String(fallback) : String(v);

export function render(template: string, data: TemplateData): [subject: string, body: string] {
  switch (template) {
    case "otp_login":
      return [
        "Your Revyu login code",
        `Your code is ${s(data.code)}. It expires in 10 minutes.\n\n` +
          `Or tap this link to log in directly: ${s(data.magic_link)}`,
      ];
    case "outlet_activated":
      return [
        "Your Revyu QR is ready",
        `${s(data.business_name)} is verified and live.\n\n` +
          `Your QR code and print files (receipt footer, handout card, counter ` +
          `standee, counter sticker) are in your dashboard: ${s(data.dashboard_url)}\n` +
          `Log in with this email address — we'll send you a one-time code.\n\n` +
          `Your review link: ${s(data.short_url)}\n\n` +
          `Print the receipt footer or hand out the cards. Keep the wording as it ` +
          `is — "scan to share your experience" — and never offer anything in ` +
          `return for a review.`,
      ];
    case "needs_info":
      return [
        "We need one more detail for your Revyu signup",
        `Thanks for signing up ${s(data.business_name)}. Before we can switch ` +
          `your QR on, we need a little more information:\n\n${s(data.message)}\n\n` +
          `Just reply to this email. Your signup stays in the queue meanwhile.`,
      ];
    case "signup_rejected":
      return [
        "About your Revyu signup",
        `We couldn't verify ${s(data.business_name)}: ${s(data.reason)}\n\n` +
          `${s(data.refund_line)}\n\nIf you think this is a mistake, reply to this email.`,
      ];
    case "first_scan":
      return [
        "First scan on your Revyu QR",
        `${s(data.business_name)} just got its first scan. Check your dashboard for the details.`,
      ];
    case "trial_threshold":
      return [
        "Your Revyu trial numbers are in",
        `${s(data.business_name)}: ${d(data.scans, 0)} scans, ` +
          `${d(data.completed, 0)} completed reviews so far. Your QR ` +
          `keeps working — pay now to unlock your full dashboard: ` +
          `${s(data.payment_link)}`,
      ];
    case "private_feedback_received":
      return [
        "New private feedback on Revyu",
        `A customer left private feedback for ${s(data.business_name)}. ` +
          `Rating: ${d(data.rating, "n/a")}. View it in your dashboard.`,
      ];
    case "weekly_digest":
      return [
        "Your weekly Revyu numbers",
        `${s(data.business_name)} this week: ${d(data.scans, 0)} scans, ` +
          `${d(data.completed, 0)} completed, rating ${d(data.rating, "n/a")}.` +
          (data.competitor_line ? `\n\nCompetitor watch: ${s(data.competitor_line)}` : ""),
      ];
    case "payment_failed":
      return [
        "Action needed: Revyu payment failed",
        `Your payment for ${s(data.business_name)} didn't go through. ` +
          `You have ${d(data.grace_days, 7)} days before collection ` +
          `pauses. Update your payment method: ${d(data.payment_link, "")}`,
      ];
    case "trial_reminder":
      return [
        `${s(data.days_left)} days left in your Revyu trial`,
        `${s(data.business_name)}: ${d(data.scans, 0)} scans and ${d(data.completed, 0)} completed ` +
          "reviews so far. Your QR code never changes. Choose a plan any time to keep " +
          `everything running: ${s(data.payment_link)}`,
      ];
    case "credits_low":
      return [
        "Only a few Revyu reviews left before collection pauses",
        `${s(data.business_name)} can collect ${s(data.credits_left)} more reviews before the QR ` +
          `shows a neutral page. Unlock now to keep collecting: ${s(data.payment_link)}`,
      ];
    case "collection_paused":
      return [
        "Your Revyu QR has paused",
        `${s(data.business_name)} has used its trial reviews, so customers now see a neutral page. ` +
          "Pay to switch collection back on instantly, with the same QR code and all your data: " +
          `${s(data.payment_link)}`,
      ];
    case "zero_scan_nudge":
      return [
        "No scans yet on your Revyu QR",
        `${s(data.business_name)} has had no scans in its first week. That usually means the QR ` +
          "is not where customers can see it. Try the payment counter, the receipt footer, or hand the " +
          "card over with the bill. Need a hand? Just reply.",
      ];
    case "gap_report":
      return [
        `Your Google review gap report - ${s(data.business_name)}`,
        `${s(data.headline)}\n\n` +
          `Nearby, the strongest are:\n${s(data.competitor_lines)}\n\n` +
          "Revyu puts a QR on your receipt so every happy customer can write a Google " +
          "review in their own words. No outcome is promised - more reviews depend on " +
          "how many customers scan." +
          "\n\n" +
          `Start your free trial: ${s(data.signup_url)}`,
      ];
    case "service_update":
      return [
        `Update on your ${s(data.service_name)} request`,
        `${s(data.message)}\n\nOpen your dashboard to see details or reply: ${s(data.dashboard_url)}`,
      ];
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}
