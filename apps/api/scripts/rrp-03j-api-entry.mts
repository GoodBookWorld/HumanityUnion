/**
 * HU-RRP-03J — isolated API entry for browser E2E.
 *
 * Starts the normal API against env-provided MongoMemoryReplSet URI.
 * Injects a local-only Turnstile verifier so Playwright can authenticate
 * without Cloudflare or Production secrets.
 *
 * Refuses Production-shaped databases and deployed platform modes.
 */
import { setTurnstileVerifierForTests } from "../src/modules/security/turnstile.js";

function assertIsolatedRuntime(): void {
  const database = process.env.MONGODB_DATABASE?.trim() ?? "";
  if (!database.startsWith("hu_test_")) {
    throw new Error(
      `rrp-03j-api-entry refuses non-isolated database "${database || "(empty)"}" (require hu_test_*).`,
    );
  }

  const uri = process.env.MONGODB_URI?.trim() ?? "";
  if (!uri.includes("127.0.0.1") && !uri.includes("localhost")) {
    throw new Error("rrp-03j-api-entry refuses non-local MONGODB_URI.");
  }

  const platform = process.env.PLATFORM_MODE?.trim().toLowerCase() ?? "";
  if (platform === "production" || platform === "beta" || platform === "staging") {
    throw new Error(`rrp-03j-api-entry refuses PLATFORM_MODE=${platform}.`);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("rrp-03j-api-entry refuses NODE_ENV=production.");
  }
}

assertIsolatedRuntime();

setTurnstileVerifierForTests(async () => ({ ok: true }));

await import("../src/index.js");
