/**
 * Production Admin identity bootstrap — Task 06.4 (Volody only).
 *
 * Dedicated Admin-aware path. Does NOT reuse Task 05 steward bootstrap unchanged.
 * Admin role is hard allow-listed — never inferred from displayName/email/publicName.
 *
 * Defaults to DRY-RUN. Writes require ALL of:
 *   --execute
 *   PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM=YES
 *   PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM=YES
 *
 * Source emails/IDs from private JSON manifest (chmod 600):
 *   PRODUCTION_ADMIN_SOURCE_MANIFEST=/path/to/admin-source.json
 *
 * Never prints full emails, password hashes, tokens, or Mongo URIs.
 *
 * DO NOT RUN --execute against production until operator GO.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  ProductionAdminBootstrapError,
  assertAdminBootstrapTargetDatabase,
  assertAdminBootstrapWriteGuards,
  assertNoSecretLeak,
  buildSafeAdminBootstrapLog,
  isExecuteModeRequested,
  loadSourceAdminManifestFromFile,
  runProductionAdminBootstrap,
} from "../modules/production-admin-bootstrap/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const executeRequested = isExecuteModeRequested();
  const confirm = process.env[PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG];
  const adminConfirm = process.env[PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG];
  const manifestPath = process.env[PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV]?.trim();

  if (!manifestPath) {
    throw new ProductionAdminBootstrapError(
      `Set ${PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV} to a chmod 600 JSON manifest path.`,
      "MISSING_MANIFEST",
    );
  }

  if (!isMongoConfigured()) {
    throw new ProductionAdminBootstrapError(
      "MongoDB is not configured (MONGODB_URI / MONGODB_DATABASE).",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  assertAdminBootstrapTargetDatabase(config.database);

  if (executeRequested) {
    assertAdminBootstrapWriteGuards({
      databaseName: config.database,
      confirm,
      adminConfirm,
      execute: true,
    });
  }

  const manifest = loadSourceAdminManifestFromFile(manifestPath);
  const identity = manifest.identities[0];
  if (!identity) {
    throw new ProductionAdminBootstrapError(
      "Admin manifest must contain exactly one identity.",
      "INVALID_MANIFEST",
    );
  }

  await connectMongoClient();
  try {
    const result = await runProductionAdminBootstrap({
      client: getMongoClient(),
      databaseName: config.database,
      identity,
      execute: executeRequested,
      confirm,
      adminConfirm,
    });

    const payload = buildSafeAdminBootstrapLog(result);
    const text = JSON.stringify(
      {
        tool: "bootstrap-production-admin-identity",
        requiredDatabase: PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
        confirmRequired: [
          `${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE}`,
          `${PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE}`,
        ],
        ...payload,
      },
      null,
      2,
    );
    assertNoSecretLeak(text);
    console.log(text);
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      tool: "bootstrap-production-admin-identity",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});
