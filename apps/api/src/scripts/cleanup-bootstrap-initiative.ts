/**
 * Operator script — remove obsolete localhost bootstrap Initiative from staging.
 *
 * Default is dry-run (inspect only). Never touches production.
 *
 * Usage (Render Staging Shell / operator machine):
 *   pnpm cleanup:bootstrap-initiative
 *   BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM=YES pnpm cleanup:bootstrap-initiative -- --execute
 *
 * Required env for --execute:
 *   MONGODB_URI, MONGODB_DATABASE=humanity_union_staging
 *   BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM=YES
 *   PLATFORM_MODE must NOT be production
 *
 * Also ensure staging API does not re-seed (PLATFORM_MODE=staging skips seed).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { resolveMongoConfig, isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import { getMongoDatabase } from "../infrastructure/mongodb/mongo-database.js";
import {
  BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV,
  BOOTSTRAP_INITIATIVE_CLEANUP_ID,
  assertAllowListedBootstrapInitiativeId,
  assertBootstrapInitiativeCleanupGuards,
  executeBootstrapInitiativeCleanup,
  formatBootstrapInitiativeCleanupPlan,
  formatBootstrapInitiativeCleanupResult,
  planBootstrapInitiativeCleanup,
  BootstrapInitiativeCleanupValidationError,
} from "../modules/bootstrap-initiative-cleanup/index.js";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const execute = hasFlag("execute");
  const initiativeId = assertAllowListedBootstrapInitiativeId(
    readArg("initiative-id") ?? BOOTSTRAP_INITIATIVE_CLEANUP_ID,
  );

  if (!isMongoConfigured()) {
    throw new BootstrapInitiativeCleanupValidationError("MONGODB_URI must be configured.");
  }

  const mongo = resolveMongoConfig();

  assertBootstrapInitiativeCleanupGuards({
    NODE_ENV: process.env.NODE_ENV,
    PLATFORM_MODE: process.env.PLATFORM_MODE,
    MONGODB_DATABASE: mongo.database,
    NODE_TEST_ENV: process.env.NODE_TEST_ENV,
    [BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV]:
      process.env[BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV],
    execute,
  });

  await connectMongoClient();

  try {
    const db = getMongoDatabase();
    console.log("Bootstrap Initiative cleanup (metadata only; payloads omitted):");
    console.log(`  database=${mongo.database}`);
    console.log(`  initiativeId=${initiativeId}`);
    console.log(`  mode=${execute ? "execute" : "dry-run"}`);

    const plan = await planBootstrapInitiativeCleanup(db, initiativeId);
    console.log("");
    console.log(formatBootstrapInitiativeCleanupPlan(plan));

    if (!execute) {
      console.log("");
      console.log("Dry-run only. No writes performed.");
      console.log(
        `To delete: ${BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV}=YES pnpm cleanup:bootstrap-initiative -- --execute`,
      );
      return;
    }

    const result = await executeBootstrapInitiativeCleanup(db, initiativeId);
    console.log("");
    console.log("Cleanup result:");
    console.log(formatBootstrapInitiativeCleanupResult(result));
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
