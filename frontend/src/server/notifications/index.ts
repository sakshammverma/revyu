import { and, eq, inArray } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { getEnv } from "@/server/env";
import { render, TEMPLATES, type TemplateData } from "./templates";

const { accounts, notifications } = schema;

// Moments worth a manual WhatsApp tap on top of the email (roadmap 1.3).
export const HIGH_VALUE_TEMPLATES: ReadonlySet<string> = new Set([
  "trial_threshold",
  "credits_low",
  "collection_paused",
  "payment_failed",
  "zero_scan_nudge",
]);

const RESEND_API_URL = "https://api.resend.com/emails";

interface NotifyResult {
  channel: string;
  status: string; // sent | failed | skipped_no_provider
  error: string | null;
}

export function normalisePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Resend over HTTP; falls back to logging when no key is set so local dev and
 * CI never depend on a live provider. The notifications table records the
 * attempt either way (a missing key in production shows as skipped_no_provider).
 */
async function sendEmail(toEmail: string, template: string, data: TemplateData): Promise<NotifyResult> {
  const [subject, body] = render(template, data);
  const env = getEnv();

  if (!env.emailProviderApiKey) {
    console.info(`EMAIL [no provider configured] to=${toEmail} subject=${subject}\n${body}`);
    return { channel: "email", status: "skipped_no_provider", error: null };
  }
  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.emailProviderApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFromAddress, to: [toEmail], subject, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return { channel: "email", status: "sent", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Email send failed to=${toEmail} template=${template}: ${message}`);
    return { channel: "email", status: "failed", error: message };
  }
}

export interface NotifyArgs {
  accountId: string;
  outletId: string | null;
  toEmail: string;
  template: string;
  data: TemplateData;
}

/** Send a notification and log it (documents/05-DATA-MODEL.md section 3.10). */
export async function notify(db: DbLike, args: NotifyArgs): Promise<void> {
  const { accountId, outletId, toEmail, template, data } = args;
  if (!(TEMPLATES as readonly string[]).includes(template)) {
    throw new Error(`Unknown notification template: ${template}`);
  }

  const result = await sendEmail(toEmail, template, data);
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    accountId,
    outletId,
    template,
    channel: result.channel,
    status: result.status,
    error: result.error,
    sentAt: result.status === "sent" ? new Date() : null,
  });

  if (HIGH_VALUE_TEMPLATES.has(template)) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    const phone = normalisePhone(account?.ownerPhone);
    if (account && phone) {
      const [, body] = render(template, data);
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        accountId,
        outletId,
        template,
        channel: "click_to_chat",
        status: "queued",
        toPhone: phone,
        body,
      });
    }
  }
}

/**
 * Like notify(), but never sends the same lifecycle message twice for an
 * outlet. Returns true if it was sent now.
 */
export async function notifyOnce(db: DbLike, args: NotifyArgs & { outletId: string }): Promise<boolean> {
  const [already] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.outletId, args.outletId),
        eq(notifications.template, args.template),
        inArray(notifications.status, ["sent", "skipped_no_provider"]),
      ),
    )
    .limit(1);
  if (already) return false;
  await notify(db, args);
  return true;
}
