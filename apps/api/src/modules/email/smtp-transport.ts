import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer/index.js";

import { resolveEmailConfig } from "./email.config.js";

let cachedTransport: Transporter | null = null;
let cachedSignature: string | null = null;

function transportSignature(config: ReturnType<typeof resolveEmailConfig>): string {
  return [
    config.smtpHost ?? "",
    config.smtpPort,
    config.smtpSecure,
    config.smtpUsername ?? "",
    config.smtpPassword ?? "",
  ].join("|");
}

/**
 * Shared Nodemailer transporter configuration — parity with apps/api/scripts/test-smtp.ts.
 * Password is passed through without trimming.
 */
export function createSmtpTransport(): Transporter {
  const config = resolveEmailConfig();

  if (!config.smtpHost) {
    throw new Error("SMTP_HOST is required when EMAIL_PROVIDER=smtp.");
  }

  const signature = transportSignature(config);

  if (cachedTransport && cachedSignature === signature) {
    return cachedTransport;
  }

  cachedTransport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
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
