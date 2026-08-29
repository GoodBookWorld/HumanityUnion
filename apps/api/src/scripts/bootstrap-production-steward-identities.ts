/**
 * Production-only steward identity bootstrap (Task 05).
 *
 * Defaults to DRY-RUN. Writes require BOTH:
 *   --execute
 *   PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM=YES
 *
 * Source emails/IDs come from a private JSON manifest (chmod 600):
 *   PRODUCTION_STEWARD_SOURCE_MANIFEST=/path/to/steward-source.json
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
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
  PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV,
  ProductionStewardBootstrapError,
  assertBootstrapTargetDatabase,
  assertBootstrapWriteGuards,
  assertNoSecretLeak,
  buildSafeBootstrapLog,
  isExecuteModeRequested,
  loadSourceStewardManifestFromFile,
  runProductionStewardBootstrap,
} from "../modules/production-steward-bootstrap/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const executeRequested = isExecuteModeRequested();
  const confirm = process.env[PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG];
  const manifestPath = process.env[PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV]?.trim();

  if (!manifestPath) {
    throw new ProductionStewardBootstrapError(
      `Set ${PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV} to a chmod 600 JSON manifest path.`,
      "MISSING_MANIFEST",
    );
  }

  if (!isMongoConfigured()) {
    throw new ProductionStewardBootstrapError(
      "MongoDB is not configured (MONGODB_URI / MONGODB_DATABASE).",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  assertBootstrapTargetDatabase(config.database);

  if (executeRequested) {
    assertBootstrapWriteGuards({
      databaseName: config.database,
      confirm,
      execute: true,
    });
  }

  const manifest = loadSourceStewardManifestFromFile(manifestPath);

  await connectMongoClient();
  try {
    const result = await runProductionStewardBootstrap({
      client: getMongoClient(),
      databaseName: config.database,
      identities: manifest.identities,
      execute: executeRequested,
      confirm,
    });

    const payload = buildSafeBootstrapLog(result);
    const text = JSON.stringify(
      {
        tool: "bootstrap-production-steward-identities",
        requiredDatabase: PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
        confirmRequired: `${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE}`,
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
      tool: "bootstrap-production-steward-identities",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});
