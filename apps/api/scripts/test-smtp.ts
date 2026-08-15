/**
 * Manual SMTP connectivity test — never run from verify:*, CI, or automated gates.
 *
 * Usage:
 *   cd apps/api && SMTP_TEST_RECIPIENT=you@yourdomain.org npm run test:smtp
 *
 * Requires an explicitly approved real recipient. Synthetic domains are rejected.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import nodemailer from "nodemailer";

import { isSyntheticTestRecipient } from "../src/modules/email/email-safety-guards.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDir, "..");

dotenv.config({ path: path.join(apiRoot, ".env"), override: true });

async function main(): Promise<void> {
  console.log("======================================");
  console.log(" Humanity Union SMTP Test (manual only)");
  console.log("======================================");
  console.log("");
  console.warn("WARNING: This command sends one real email through the configured SMTP provider.");
  console.warn("Do not run this from automated verification or CI.");
  console.log("");

  const recipient = process.env.SMTP_TEST_RECIPIENT?.trim() || "";

  if (!recipient) {
    console.error(
      "Missing recipient. Set SMTP_TEST_RECIPIENT to a user-approved real inbox before running test:smtp.",
    );
    process.exitCode = 1;
    return;
  }

  if (isSyntheticTestRecipient(recipient)) {
    console.error(
      "Refusing synthetic/test recipient. Real SMTP smoke must use an approved production-class inbox.",
    );
    process.exitCode = 1;
    return;
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USERNAME?.trim() || process.env.SMTP_USER?.trim();
  const from =
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim();
  const fromName =
    process.env.SMTP_FROM_NAME?.trim() ||
    process.env.EMAIL_FROM_NAME?.trim() ||
    "Humanity Union";

  console.log("SMTP Host:", host);
  console.log("SMTP Port:", process.env.SMTP_PORT);
  console.log("SMTP Secure:", process.env.SMTP_SECURE);
  console.log("SMTP Username:", user);
  console.log("SMTP Password Length:", process.env.SMTP_PASSWORD?.length ?? 0);
  console.log("From:", `${fromName} <${from}>`);
  console.log("Recipient:", recipient);
  console.log("");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    auth: {
      user,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  console.log("Checking SMTP connection...");
  console.log("");

  try {
    await transporter.verify();
    console.log("SMTP AUTH SUCCESS");
    console.log("Connection verified.");
    console.log("");
    console.log("Sending one test email...");

    const info = await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to: recipient,
      subject: "Humanity Union email delivery test",
      text: "Humanity Union email delivery test confirmation. SMTP accepted this message.",
      html: "<p>Humanity Union email delivery test confirmation.</p><p>SMTP accepted this message.</p>",
    });

    console.log("");
    console.log("EMAIL SENT");
    console.log(info.messageId);
  } catch (error) {
    console.log("");
    console.log("SMTP FAILED");
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
