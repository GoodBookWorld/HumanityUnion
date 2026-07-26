/**
 * Development-only utility to reset auth-code rate-limit send logs for manual QA.
 *
 * Usage:
 *   npm run dev:reset-auth-rate-limits -- --email test@example.org
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { resetAuthCodeRateLimitsForAccount } from "../modules/auth/auth-code-rate-limit-reset.js";

loadApiEnvironment();

function readEmailArg(): string {
  const emailIndex = process.argv.indexOf("--email");

  if (emailIndex === -1 || !process.argv[emailIndex + 1]) {
    console.error("Usage: npm run dev:reset-auth-rate-limits -- --email user@example.org");
    process.exit(1);
  }

  return process.argv[emailIndex + 1]!.trim().toLowerCase();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("dev:reset-auth-rate-limits is disabled in production.");
    process.exit(1);
  }

  const email = readEmailArg();
  const result = await resetAuthCodeRateLimitsForAccount({ email });

  console.log(
    `Reset auth-code rate-limit records for ${result.maskedEmail}: ${result.categories.join(", ")}`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
