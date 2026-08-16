/**
 * STAGING DATA MIGRATION PACK 02 — controlled historical import.
 *
 * Defaults to DRY RUN (no writes).
 *
 * Execute requires BOTH:
 *   ALLOW_STAGING_DATA_MIGRATION=true
 *   --execute
 *
 * Plus NODE_ENV=production, PLATFORM_MODE=staging, target=humanity_union_staging.
 *
 * Usage:
 *   pnpm migrate:staging-historical-data
 *   pnpm migrate:staging-historical-data -- --execute
 *
 * Never prints MONGODB_URI / passwords / hashes / tokens.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  STAGING_DATA_MIGRATION_FLAG,
  assertApprovedSourcesPresent,
  assertStagingDataMigrationDatabasePair,
  assertStagingDataMigrationExecuteGuards,
  buildMigrationPlan,
  executeStagingHistoricalMigration,
  isExecuteModeRequested,
  loadMigrationSourceBundle,
  resolveDefaultRuntimeDir,
  resolveRepoRoot,
  validatePack01Manifest,
  StagingDataMigrationError,
} from "../modules/staging-data-migration/index.js";

loadApiEnvironment();

function parseArg(name: string): string | undefined {
  const match = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3).trim() : undefined;
}

async function main(): Promise<void> {
  const execute = isExecuteModeRequested();
  const sourceDatabase = parseArg("source") ?? APPROVED_SOURCE_DATABASE;
  const targetDatabase = parseArg("target") ?? APPROVED_TARGET_DATABASE;
  const repoRoot = resolveRepoRoot(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."));
  const runtimeDir = parseArg("runtime-dir") ?? resolveDefaultRuntimeDir(repoRoot);

  console.log(
    JSON.stringify(
      {
        pack: "STAGING_DATA_MIGRATION_PACK_02",
        mode: execute ? "execute" : "dry-run",
        sourceDatabase,
        targetDatabase,
        runtimeDir: path.relative(repoRoot, runtimeDir),
        credentials: "redacted",
        note: execute
          ? "Execute mode requested — guards will be enforced before any write."
          : "DRY RUN default — no writes unless ALLOW_STAGING_DATA_MIGRATION=true and --execute.",
      },
      null,
      2,
    ),
  );

  validatePack01Manifest(repoRoot);

  assertStagingDataMigrationDatabasePair({
    sourceDatabase,
    targetDatabase,
    nodeTestEnv: process.env.NODE_TEST_ENV === "true",
  });

  if (execute) {
    assertStagingDataMigrationExecuteGuards({
      NODE_ENV: process.env.NODE_ENV,
      PLATFORM_MODE: process.env.PLATFORM_MODE,
      ALLOW_STAGING_DATA_MIGRATION: process.env.ALLOW_STAGING_DATA_MIGRATION,
      NODE_TEST_ENV: process.env.NODE_TEST_ENV,
      sourceDatabase,
      targetDatabase,
      execute: true,
    });
  } else if (process.env.ALLOW_STAGING_DATA_MIGRATION === "true" && !execute) {
    console.log(
      JSON.stringify({
        warning: `${STAGING_DATA_MIGRATION_FLAG}=true but --execute not set; remaining in dry-run (no writes).`,
      }),
    );
  }

  if (!isMongoConfigured()) {
    throw new StagingDataMigrationError("MONGODB_URI must be configured (value never logged).");
  }

  // Refuse accidental execute against whatever MONGODB_DATABASE is if it conflicts.
  const configuredDatabase = resolveMongoConfig().database;
  if (
    execute &&
    configuredDatabase !== targetDatabase &&
    process.env.NODE_TEST_ENV !== "true"
  ) {
    throw new StagingDataMigrationError(
      `Refusing execute: MONGODB_DATABASE logical name "${configuredDatabase}" must equal target "${targetDatabase}".`,
    );
  }

  if (!fs.existsSync(path.join(runtimeDir, "initiatives.json"))) {
    throw new StagingDataMigrationError(
      `File runtime initiatives.json not found under ${path.relative(repoRoot, runtimeDir)}.`,
    );
  }

  await connectMongoClient();
  try {
    const client = getMongoClient();
    const bundle = await loadMigrationSourceBundle({
      client,
      sourceDatabase,
      targetDatabase,
      runtimeDir,
    });
    assertApprovedSourcesPresent(bundle);
    const plan = buildMigrationPlan(bundle);

    const planOut =
      parseArg("plan-out") ??
      path.join(repoRoot, "architecture/recovery/STAGING_DATA_MIGRATION_DRY_RUN_PLAN_v1.0.json");
    fs.mkdirSync(path.dirname(planOut), { recursive: true });
    fs.writeFileSync(planOut, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          dryRunPlanPath: path.relative(repoRoot, planOut),
          stagingAdminProtected: plan.stagingAdmin.protected,
          participantActions: plan.participants.map((p) => ({
            key: p.key,
            action: p.action,
            authAction: p.authAction,
            classification: p.classification,
            emailMasked: p.emailMasked,
          })),
          initiativeActions: plan.initiatives.map((i) => ({
            initiativeId: i.initiativeId,
            title: i.title,
            action: i.action,
            stewardMemberId: i.stewardMemberId,
            related: i.related,
          })),
          relatedArtifacts: plan.relatedArtifacts,
          excludedLegacy: plan.excludedLegacy,
          expectedTargetCounts: plan.expectedTargetCounts,
          conflicts: plan.conflicts,
          integrityIssues: plan.integrityIssues,
          bootstrapInitiative: plan.bootstrapInitiative,
        },
        null,
        2,
      ),
    );

    if (!execute) {
      console.log(
        JSON.stringify({
          confirmation:
            plan.conflicts.length > 0
              ? "DRY RUN COMPLETE WITH CONFLICTS — NO DATA WAS WRITTEN. Resolve conflicts before --execute."
              : "DRY RUN COMPLETE — NO DATA WAS WRITTEN, UPDATED, DELETED, OR MIGRATED.",
          conflictCount: plan.conflicts.length,
        }),
      );
      if (plan.conflicts.length > 0) {
        process.exitCode = 2;
      }
      return;
    }

    if (plan.conflicts.length > 0) {
      throw new StagingDataMigrationError(
        `Migration plan has ${plan.conflicts.length} conflict(s); refusing to continue.`,
      );
    }

    const writeSummary = await executeStagingHistoricalMigration({
      client,
      sourceDatabase,
      targetDatabase,
      runtimeDir,
      repoRoot,
      plan: { ...plan, mode: "execute" },
    });

    console.log(JSON.stringify(writeSummary, null, 2));
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
