import net from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/server/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/env")>();
  return { ...actual, getEnv: () => envState.value as unknown as ReturnType<typeof actual.getEnv> };
});

import { loadEnv } from "@/server/env";
import { sendEmail } from "./index";
import { deliver, emailProvider } from "./transport";

const BASE = {
  emailFromAddress: "Revyu <noreply@example.com>",
  emailProviderApiKey: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
};

/** A tiny in-process SMTP server: accepts AUTH PLAIN/LOGIN and records the message. */
function startSmtpServer() {
  const received: { auth: string[]; from: string; to: string[]; data: string }[] = [];
  const server = net.createServer((socket) => {
    const msg = { auth: [] as string[], from: "", to: [] as string[], data: "" };
    let inData = false;
    let buffer = "";
    socket.write("220 test.local ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (inData) {
        if (!buffer.includes("\r\n.\r\n")) return;
        msg.data = buffer.slice(0, buffer.indexOf("\r\n.\r\n"));
        buffer = "";
        inData = false;
        received.push(msg);
        socket.write("250 queued\r\n");
        return;
      }
      for (const line of buffer.split("\r\n").filter(Boolean)) {
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) socket.write("250-test.local\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (upper.startsWith("AUTH PLAIN")) {
          msg.auth.push(Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8").replace(/\0/g, "|"));
          socket.write("235 ok\r\n");
        } else if (upper.startsWith("MAIL FROM")) {
          msg.from = line;
          socket.write("250 ok\r\n");
        } else if (upper.startsWith("RCPT TO")) {
          msg.to.push(line);
          socket.write("250 ok\r\n");
        } else if (upper === "DATA") {
          inData = true;
          socket.write("354 go\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("250 ok\r\n");
      }
      if (!inData) buffer = "";
    });
  });
  return new Promise<{ port: number; received: typeof received; close: () => Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        received,
        close: () => new Promise<void>((r) => server.close(() => r())),
      }),
    ),
  );
}

beforeEach(() => {
  envState.value = { ...BASE };
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("emailProvider", () => {
  it("prefers Resend, then SMTP, then nothing", () => {
    expect(emailProvider({ ...BASE, emailProviderApiKey: "re_x", smtpHost: "h", smtpUser: "u", smtpPass: "p" })).toBe("resend");
    expect(emailProvider({ ...BASE, smtpHost: "h", smtpUser: "u", smtpPass: "p" })).toBe("smtp");
    expect(emailProvider(BASE)).toBe("none");
  });

  it("needs host, user and password together for SMTP", () => {
    expect(emailProvider({ ...BASE, smtpHost: "h", smtpUser: "u" })).toBe("none");
    expect(emailProvider({ ...BASE, smtpHost: "h", smtpPass: "p" })).toBe("none");
  });
});

describe("deliver", () => {
  const message = { to: "owner@example.com", subject: "Hello", text: "Body text" };

  it("logs and reports skipped_no_provider when nothing is configured", async () => {
    expect(await deliver(message)).toEqual({ channel: "email", status: "skipped_no_provider", error: null });
  });

  it("sends through Resend when a key is set, and reports an HTTP failure as failed", async () => {
    envState.value = { ...BASE, emailProviderApiKey: "re_secret" };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response("no", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await deliver(message)).status).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_secret" });
    expect(JSON.parse(init.body)).toEqual({ from: BASE.emailFromAddress, to: [message.to], subject: "Hello", text: "Body text" });
    expect(await deliver(message)).toMatchObject({ status: "failed", error: "HTTP 422" });
  });

  it("sends through SMTP with the configured login", async () => {
    const smtp = await startSmtpServer();
    try {
      envState.value = { ...BASE, smtpHost: "127.0.0.1", smtpPort: smtp.port, smtpUser: "me@example.com", smtpPass: "app-password" };
      const result = await deliver(message);
      expect(result).toEqual({ channel: "email", status: "sent", error: null });
      const [got] = smtp.received;
      expect(got.auth).toEqual(["|me@example.com|app-password"]);
      expect(got.from).toContain("noreply@example.com");
      expect(got.to.join()).toContain("owner@example.com");
      expect(got.data).toContain("Subject: Hello");
      expect(got.data).toContain("Body text");
    } finally {
      await smtp.close();
    }
  });

  it("renders a real template through SMTP", async () => {
    const smtp = await startSmtpServer();
    try {
      envState.value = { ...BASE, smtpHost: "127.0.0.1", smtpPort: smtp.port, smtpUser: "u", smtpPass: "p" };
      const result = await sendEmail("owner@example.com", "otp_login", { code: "482913", magic_link: "https://x/y" });
      expect(result.status).toBe("sent");
      expect(smtp.received[0].data).toContain("Your Revyu login code");
      expect(smtp.received[0].data).toContain("482913");
    } finally {
      await smtp.close();
    }
  });

  it("reports an unreachable SMTP server as failed instead of throwing", async () => {
    const probe = await startSmtpServer();
    const deadPort = probe.port;
    await probe.close(); // nothing listens there any more
    envState.value = { ...BASE, smtpHost: "127.0.0.1", smtpPort: deadPort, smtpUser: "u", smtpPass: "p" };
    const result = await deliver(message);
    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();
  });
});

describe("production guard for email", () => {
  const prod = {
    ENVIRONMENT: "production",
    DATABASE_URL: "postgresql://a@h/d",
    ADMIN_SESSION_SECRET: "x".repeat(32),
    AUTH_SECRET: "y".repeat(32),
    CRON_SECRET: "z".repeat(32),
    FRONTEND_BASE_URL: "https://revyu.example.com",
    PUBLIC_FLOW_BASE_URL: "https://revyu.example.com",
    RAZORPAY_KEY_ID: "k",
    RAZORPAY_KEY_SECRET: "k",
    RAZORPAY_WEBHOOK_SECRET: "k",
    GOOGLE_PLACES_API_KEY: "k",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "k",
  };

  it("accepts a Resend key", () => {
    expect(() => loadEnv({ ...prod, EMAIL_PROVIDER_API_KEY: "re_x" })).not.toThrow();
  });

  it("accepts a complete SMTP login instead", () => {
    const env = loadEnv({ ...prod, SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(env.smtpPort).toBe(587);
    expect(loadEnv({ ...prod, SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", SMTP_PORT: "465" }).smtpPort).toBe(465);
  });

  it("refuses to start with no email provider, or an incomplete SMTP login", () => {
    expect(() => loadEnv(prod)).toThrow(/EMAIL_PROVIDER_API_KEY \(Resend\) or SMTP_HOST \+ SMTP_USER \+ SMTP_PASS/);
    expect(() => loadEnv({ ...prod, SMTP_HOST: "h", SMTP_USER: "u" })).toThrow(/SMTP_HOST \+ SMTP_USER \+ SMTP_PASS/);
  });

  it("refuses localhost, http or missing public addresses", () => {
    const ok = { ...prod, EMAIL_PROVIDER_API_KEY: "re_x" };
    expect(() => loadEnv({ ...ok, FRONTEND_BASE_URL: undefined })).toThrow(/FRONTEND_BASE_URL must be your public https/);
    expect(() => loadEnv({ ...ok, FRONTEND_BASE_URL: "http://localhost:3000" })).toThrow(/FRONTEND_BASE_URL/);
    expect(() => loadEnv({ ...ok, PUBLIC_FLOW_BASE_URL: "http://revyu.example.com" })).toThrow(/PUBLIC_FLOW_BASE_URL/);
    expect(() => loadEnv({ ...ok, PUBLIC_FLOW_BASE_URL: "https://127.0.0.1" })).toThrow(/PUBLIC_FLOW_BASE_URL/);
  });

  it("local needs no email provider", () => {
    expect(() => loadEnv({ DATABASE_URL: "postgresql://a@h/d" })).not.toThrow();
  });
});
