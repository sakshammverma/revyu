/**
 * The one place that actually sends an email. Provider order:
 *   1. Resend (EMAIL_PROVIDER_API_KEY)  - HTTP API
 *   2. SMTP   (SMTP_HOST/PORT/USER/PASS) - any provider with an SMTP login
 *   3. neither: log it and report skipped_no_provider (local dev, CI)
 * The notifications table records the outcome either way, so a missing
 * provider in production is visible as skipped_no_provider.
 */
import nodemailer, { type Transporter } from "nodemailer";

import { getEnv, type Env } from "@/server/env";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface RawEmail {
  to: string;
  subject: string;
  text: string;
}

export interface SendResult {
  channel: string;
  status: string; // sent | failed | skipped_no_provider
  error: string | null;
}

export type EmailProvider = "resend" | "smtp" | "none";

export function emailProvider(env: Pick<Env, "emailProviderApiKey" | "smtpHost" | "smtpUser" | "smtpPass">): EmailProvider {
  if (env.emailProviderApiKey) return "resend";
  if (env.smtpHost && env.smtpUser && env.smtpPass) return "smtp";
  return "none";
}

const globalForMail = globalThis as unknown as { __revyuMail?: { key: string; transport: Transporter } };

/** One transporter per server instance (nodemailer opens connections per send). */
function smtpTransport(env: Env): Transporter {
  const key = `${env.smtpHost}:${env.smtpPort}:${env.smtpUser}`;
  if (globalForMail.__revyuMail?.key !== key) {
    globalForMail.__revyuMail = {
      key,
      transport: nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        // 465 is implicit TLS; 587 upgrades with STARTTLS. Port 25 is blocked on most hosts.
        secure: env.smtpPort === 465,
        auth: { user: env.smtpUser, pass: env.smtpPass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    };
  }
  return globalForMail.__revyuMail.transport;
}

export async function deliver(message: RawEmail): Promise<SendResult> {
  const env = getEnv();
  const provider = emailProvider(env);

  if (provider === "none") {
    console.info(`EMAIL [no provider configured] to=${message.to} subject=${message.subject}\n${message.text}`);
    return { channel: "email", status: "skipped_no_provider", error: null };
  }
  try {
    if (provider === "resend") {
      const resp = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.emailProviderApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.emailFromAddress, to: [message.to], subject: message.subject, text: message.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } else {
      await smtpTransport(env).sendMail({
        from: env.emailFromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    }
    return { channel: "email", status: "sent", error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Email send failed (${provider}) to=${message.to} subject=${message.subject}: ${error}`);
    return { channel: "email", status: "failed", error };
  }
}
