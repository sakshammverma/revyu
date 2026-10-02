import { and, eq, inArray } from "drizzle-orm";

import { schema, type DbLike } from "@/server/db";
import { render, TEMPLATES, type TemplateData } from "./templates";
import { deliver, type SendResult } from "./transport";

const { accounts, notifications } = schema;

// Moments worth a manual WhatsApp tap on top of the email (roadmap 1.3).
export const HIGH_VALUE_TEMPLATES: ReadonlySet<string> = new Set([
  "trial_threshold",
  "credits_low",
  "collection_paused",
  "payment_failed",
  "zero_scan_nudge",
]);

export function normalisePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Renders a template and sends it through the configured provider (see transport.ts). */
export async function sendEmail(toEmail: string, template: string, data: TemplateData): Promise<SendResult> {
  const [subject, text] = render(template, data);
  return deliver({ to: toEmail, subject, text });
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
