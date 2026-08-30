/**
 * Production auth activation — queue canonical password-reset emails for
 * migrated/bootstrap Participant shells (and production Admin).
 *
 * Default: DRY-RUN (no emails).
 *
 * Execute requires:
 *   --execute
 *   PRODUCTION_AUTH_ACTIVATION_CONFIRM=YES
 *   Mongo destination humanity_union_production
 *
 * Optional extras (userIds only, never emails):
 *   PRODUCTION_AUTH_ACTIVATION_USER_IDS=uuid,uuid
 *
 * Never prints emails, password hashes, or raw tokens.
 * Does NOT set passwords or alter roles.
 *
 * DO NOT run --execute against production from Cursor automation.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG,
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
  ProductionAuthActivationError,
  assertNoSecretLeak,
  isProductionAuthActivationExecuteRequested,
  resolveProductionAuthActivationMode,
  runProductionAuthActivation,
} from "../modules/production-auth-activation/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const executeRequested = isProductionAuthActivationExecuteRequested();
  const confirm = process.env[PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG];
  const mode = resolveProductionAuthActivationMode({
    execute: executeRequested,
    confirm,
  });

  if (executeRequested && mode === "dry-run") {
    throw new ProductionAuthActivationError(
      `Refusing write: set ${PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG}=${PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }

  if (!isMongoConfigured()) {
    throw new ProductionAuthActivationError(
      "MongoDB is not configured (MONGODB_URI / MONGODB_DATABASE).",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  await connectMongoClient();
  try {
    const report = await runProductionAuthActivation({
      destinationDatabase: config.database,
      execute: executeRequested,
      confirm,
    });

    const payload = {
      ...report,
      confirmRequired: `${PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG}=${PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE}`,
      note:
        mode === "dry-run"
          ? "Dry-run only. Zero emails. Pass --execute with CONFIRM=YES to queue password-reset emails."
          : "Execute mode. Canonical password-reset emails queued; users must set NEW passwords then confirm email.",
    };
    const text = JSON.stringify(payload, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
    if (report.overallStatus === "FAILED" || report.overallStatus === "BLOCKED") {
      process.exitCode = 1;
    }
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/[A-Za-z0-9+/_-]{24,}/g, "[redacted]");
  try {
    assertNoSecretLeak(safe);
    console.error(
      JSON.stringify({
        tool: "activate-production-auth",
        ok: false,
        error: safe,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        tool: "activate-production-auth",
        ok: false,
        error: "[redacted]",
      }),
    );
  }
  process.exitCode = 1;
});
