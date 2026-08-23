/**
 * Compact staging verification for operators (Pack 04).
 *
 * Usage (RENDER API WEB SHELL when verifying live staging):
 *   pnpm verify:staging
 *   pnpm verify:staging -- --check-media-http
 *
 * Pack 10F — when WEB_ORIGIN / NEXT_PUBLIC_SITE_URL / VERIFY_STAGING_WEB_URL is set,
 * also probes /data/geography/communities/CA/CA-BC.json (webGeographyAssets).
 *
 * Never prints secrets, emails, or password hashes.
 *
 * Note: the older VPS runbook checker is available as:
 *   pnpm verify:staging-runbook
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  APPROVED_TARGET_DATABASE,
  formatStagingVerificationSummary,
  verifyStagingHistoricalState,
  StagingReconciliationError,
} from "../modules/staging-reconciliation/index.js";

loadApiEnvironment();

function parseArg(name: string): string | undefined {
  const match = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3).trim() : undefined;
}

async function main(): Promise<void> {
  const checkMediaHttp = process.argv.includes("--check-media-http");
  const targetDatabase =
    parseArg("target") ?? process.env.VERIFY_STAGING_DATABASE ?? APPROVED_TARGET_DATABASE;

  if (!isMongoConfigured()) {
    throw new StagingReconciliationError("MONGODB_URI must be configured (value never logged).");
  }

  console.log(
    JSON.stringify({
      command: "verify:staging",
      targetDatabase,
      checkMediaHttp,
      credentials: "redacted",
      script: path.relative(
        process.cwd(),
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "verify-staging.ts"),
      ),
    }),
  );

  await connectMongoClient();
  try {
    const summary = await verifyStagingHistoricalState({
      client: getMongoClient(),
      targetDatabase,
      checkMediaHttp,
    });
    process.stdout.write(formatStagingVerificationSummary(summary));
    if (summary.result === "FAIL") process.exitCode = 1;
    else if (summary.result === "WARN") process.exitCode = 0;
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
