import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer/index.js";

import { resolveEmailConfig } from "./email.config.js";
import { mustForceMockEmailProvider } from "./email-safety-guards.js";

let cachedTransport: Transporter | null = null;
let cachedSignature: string | null = null;

function transportSignature(config: ReturnType<typeof resolveEmailConfig>): string {
  return [
    config.smtpHost ?? "",
    config.smtpPort,
    config.smtpSecure,
    config.smtpUsername ?? "",
    config.smtpPassword ?? "",
    config.smtpConnectionTimeoutMs,
    config.smtpGreetingTimeoutMs,
    config.smtpSocketTimeoutMs,
  ].join("|");
}

/**
 * Shared Nodemailer transporter with pooling and timeouts.
 * TLS certificate validation remains enabled (rejectUnauthorized defaults to true).
 * Refuses construction in automated test/verification environments.
 */
export function createSmtpTransport(): Transporter {
  if (mustForceMockEmailProvider()) {
    throw new Error(
      "SMTP transport refused: automated test/verification environment must use the mock provider.",
    );
  }

  const config = resolveEmailConfig();

  if (!config.smtpHost) {
    throw new Error("SMTP_HOST is required when EMAIL_PROVIDER=smtp.");
  }

  const signature = transportSignature(config);

  if (cachedTransport && cachedSignature === signature) {
    return cachedTransport;
  }

  if (cachedTransport) {
    void cachedTransport.close();
  }

  cachedTransport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: config.smtpConnectionTimeoutMs,
    greetingTimeout: config.smtpGreetingTimeoutMs,
    socketTimeout: config.smtpSocketTimeoutMs,
    tls: {
      // Never disable certificate validation to "make it work".
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    auth:
      config.smtpUsername && config.smtpPassword
        ? {
            user: config.smtpUsername,
            pass: config.smtpPassword,
          }
        : undefined,
  });
  cachedSignature = signature;

  return cachedTransport;
}

export function resetSmtpTransportForTests(): void {
  void cachedTransport?.close();
  cachedTransport = null;
  cachedSignature = null;
}

export function hasCachedSmtpTransportForTests(): boolean {
  return cachedTransport !== null;
}
