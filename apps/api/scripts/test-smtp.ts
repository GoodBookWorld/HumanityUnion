/**
 * Manual SMTP connectivity test — never run from verify:*, CI, or automated gates.
 *
 * Usage:
 *   cd apps/api && npm run test:smtp
 *
 * Optional:
 *   SMTP_TEST_RECIPIENT=you@example.org npm run test:smtp
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

  const recipient =
    process.env.SMTP_TEST_RECIPIENT?.trim() || process.env.SMTP_USERNAME?.trim() || "";

  if (!recipient) {
    console.error(
      "Missing recipient. Set SMTP_TEST_RECIPIENT or SMTP_USERNAME before running test:smtp.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("SMTP Host:", process.env.SMTP_HOST);
  console.log("SMTP Port:", process.env.SMTP_PORT);
  console.log("SMTP Secure:", process.env.SMTP_SECURE);
  console.log("SMTP Username:", process.env.SMTP_USERNAME);
  console.log("SMTP Password Length:", process.env.SMTP_PASSWORD?.length ?? 0);
  console.log("Recipient:", recipient);
  console.log("");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USERNAME,
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
      from: `"${process.env.EMAIL_FROM_NAME ?? "Humanity Union"}" <${process.env.SMTP_FROM}>`,
      to: recipient,
      subject: "Humanity Union SMTP Test",
      text: "SMTP configuration works correctly.",
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
