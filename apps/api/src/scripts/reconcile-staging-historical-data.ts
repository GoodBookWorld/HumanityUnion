/**
 * STAGING HISTORICAL DATA RECONCILIATION PACK 04
 *
 * Defaults to DRY RUN (no writes).
 *
 * Execute requires BOTH:
 *   ALLOW_STAGING_RECONCILIATION=true
 *   --execute
 *
 * Plus NODE_ENV=production, PLATFORM_MODE=staging, target=humanity_union_staging.
 *
 * Usage (RENDER API WEB SHELL or LOCAL MAC TERMINAL when labeled):
 *   pnpm reconcile:staging-historical-data
 *   pnpm reconcile:staging-historical-data -- --execute
 *
 * Never prints MONGODB_URI / passwords / hashes / tokens / R2 secrets.
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
  PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH,
  STAGING_RECONCILIATION_FLAG,
  assertStagingReconciliationDatabasePair,
  assertStagingReconciliationExecuteGuards,
  buildReconciliationPlan,
  executeStagingReconciliation,
  isExecuteModeRequested,
  loadAndValidateReconciliationBundle,
  resolveReconciliationBundleDir,
  resolveRepoRoot,
  StagingReconciliationError,
} from "../modules/staging-reconciliation/index.js";

loadApiEnvironment();

function parseArg(name: string): string | undefined {
  const match = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3).trim() : undefined;
}

async function main(): Promise<void> {
  const execute = isExecuteModeRequested();
  const sourceDatabase = parseArg("source") ?? APPROVED_SOURCE_DATABASE;
  const targetDatabase = parseArg("target") ?? APPROVED_TARGET_DATABASE;
  const repoRoot = resolveRepoRoot(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
  );
  const bundleDir = resolveReconciliationBundleDir(repoRoot, parseArg("bundle-dir"));

  console.log(
    JSON.stringify(
      {
        pack: "STAGING_HISTORICAL_DATA_RECONCILIATION_PACK_04",
        mode: execute ? "execute" : "dry-run",
        sourceDatabase,
        targetDatabase,
        bundle: PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH,
        credentials: "redacted",
        note: execute
          ? "Execute mode requested — guards enforced before any write."
          : "DRY RUN default — no writes unless ALLOW_STAGING_RECONCILIATION=true and --execute.",
      },
      null,
      2,
    ),
  );

  assertStagingReconciliationDatabasePair({
    sourceDatabase,
    targetDatabase,
    nodeTestEnv: process.env.NODE_TEST_ENV === "true",
  });

  if (execute) {
    assertStagingReconciliationExecuteGuards({
      NODE_ENV: process.env.NODE_ENV,
      PLATFORM_MODE: process.env.PLATFORM_MODE,
      ALLOW_STAGING_RECONCILIATION: process.env.ALLOW_STAGING_RECONCILIATION,
      NODE_TEST_ENV: process.env.NODE_TEST_ENV,
      sourceDatabase,
      targetDatabase,
      execute: true,
    });
  } else if (process.env.ALLOW_STAGING_RECONCILIATION === "true" && !execute) {
    console.log(
      JSON.stringify({
        warning: `${STAGING_RECONCILIATION_FLAG}=true but --execute not set; remaining in dry-run (no writes).`,
      }),
    );
  }

  if (!isMongoConfigured()) {
    throw new StagingReconciliationError("MONGODB_URI must be configured (value never logged).");
  }

  const configuredDatabase = resolveMongoConfig().database;
  if (
    execute &&
    configuredDatabase !== targetDatabase &&
    process.env.NODE_TEST_ENV !== "true"
  ) {
    throw new StagingReconciliationError(
      `Refusing execute: MONGODB_DATABASE logical name "${configuredDatabase}" must equal target "${targetDatabase}".`,
    );
  }

  const bundle = loadAndValidateReconciliationBundle(bundleDir);

  await connectMongoClient();
  try {
    const client = getMongoClient();
    const plan = await buildReconciliationPlan({
      client,
      sourceDatabase,
      targetDatabase,
      bundle,
    });

    const planOut =
      parseArg("plan-out") ??
      path.join(
        repoRoot,
        "architecture/recovery/STAGING_RECONCILIATION_DRY_RUN_PLAN_v1.0.json",
      );
    fs.mkdirSync(path.dirname(planOut), { recursive: true });
    fs.writeFileSync(planOut, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          dryRunPlanPath: path.relative(repoRoot, planOut),
          stagingAdminProtected: plan.stagingAdminProtected,
          auth: plan.auth.map((item) => ({
            key: item.key,
            action: item.action,
            loginReadyAfter: item.loginReadyAfter,
            reason: item.reason,
          })),
          counts: plan.counts,
          pack05: plan.pack05,
          media: plan.media.map((item) => ({
            initiativeId: item.initiativeId,
            action: item.action,
            imageHost: item.imageHost,
            isLocalhost: item.isLocalhost,
          })),
          statistics: plan.statistics,
          excludedLegacy: plan.excludedLegacy,
          conflicts: plan.conflicts,
          integrityIssues: plan.integrityIssues,
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
              ? "DRY RUN COMPLETE WITH CONFLICTS — NO DATA WAS WRITTEN."
              : "DRY RUN COMPLETE — NO DATA WAS WRITTEN, UPDATED, DELETED, OR RECONCILED.",
          conflictCount: plan.conflicts.length,
        }),
      );
      if (plan.conflicts.length > 0) process.exitCode = 2;
      return;
    }

    const writeSummary = await executeStagingReconciliation({
      client,
      sourceDatabase,
      targetDatabase,
      bundle,
      plan: { ...plan, mode: "execute" },
    });

    console.log(
      JSON.stringify(
        {
          ...writeSummary,
          // never include hashes
          passwordHashes: "redacted",
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
