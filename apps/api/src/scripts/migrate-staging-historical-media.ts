/**
 * STAGING DATA MIGRATION PACK 03 — historical media recovery.
 *
 * Defaults to DRY RUN. Uploads Initiative covers + Participant avatars from:
 *   architecture/recovery/staging-media-source-v1/
 *
 * Execute requires BOTH:
 *   ALLOW_STAGING_MEDIA_MIGRATION=true
 *   --execute
 *
 * Plus NODE_ENV=production, PLATFORM_MODE=staging, MEDIA_STORAGE_PROVIDER=r2,
 * target=humanity_union_staging, and R2 configuration.
 *
 * Never prints R2 secrets / MONGODB_URI / credentials.
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
import { resolveMediaObjectStorage } from "../modules/media-upload/resolve-media-object-storage.js";
import {
  APPROVED_TARGET_DATABASE,
  PORTABLE_MEDIA_SOURCE_RELATIVE_PATH,
  STAGING_MEDIA_MIGRATION_FLAG,
  StagingHistoricalMediaError,
  assertStagingMediaMigrationExecuteGuards,
  executeStagingHistoricalMediaMigration,
  isExecuteModeRequested,
  loadAndValidatePortableMediaSource,
  loadTargetMediaContext,
  resolvePortableMediaSourceDir,
} from "../modules/staging-historical-media/index.js";

loadApiEnvironment();

function parseArg(name: string): string | undefined {
  const match = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3).trim() : undefined;
}

function resolveRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(fromDir);
}

async function main(): Promise<void> {
  const execute = isExecuteModeRequested();
  const targetDatabase = parseArg("target") ?? APPROVED_TARGET_DATABASE;
  const repoRoot = resolveRepoRoot(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
  );
  const mediaSourceDir = resolvePortableMediaSourceDir(
    repoRoot,
    parseArg("media-source-dir"),
  );

  console.log(
    JSON.stringify(
      {
        pack: "STAGING_DATA_MIGRATION_PACK_03",
        mode: execute ? "execute" : "dry-run",
        targetDatabase,
        mediaSource: PORTABLE_MEDIA_SOURCE_RELATIVE_PATH,
        mediaSourceDir: path.relative(repoRoot, mediaSourceDir) || mediaSourceDir,
        credentials: "redacted",
        note: execute
          ? "Execute mode requested — guards will be enforced before any write."
          : "DRY RUN default — no uploads/updates unless ALLOW_STAGING_MEDIA_MIGRATION=true and --execute.",
      },
      null,
      2,
    ),
  );

  const portable = loadAndValidatePortableMediaSource(mediaSourceDir);

  if (execute) {
    assertStagingMediaMigrationExecuteGuards({
      NODE_ENV: process.env.NODE_ENV,
      PLATFORM_MODE: process.env.PLATFORM_MODE,
      ALLOW_STAGING_MEDIA_MIGRATION: process.env.ALLOW_STAGING_MEDIA_MIGRATION,
      MEDIA_STORAGE_PROVIDER: process.env.MEDIA_STORAGE_PROVIDER,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
      NODE_TEST_ENV: process.env.NODE_TEST_ENV,
      targetDatabase,
      execute: true,
    });
  } else if (process.env.ALLOW_STAGING_MEDIA_MIGRATION === "true" && !execute) {
    console.log(
      JSON.stringify({
        warning: `${STAGING_MEDIA_MIGRATION_FLAG}=true but --execute not set; remaining in dry-run.`,
      }),
    );
  }

  if (!isMongoConfigured()) {
    throw new StagingHistoricalMediaError("MONGODB_URI must be configured (value never logged).");
  }

  const configuredDatabase = resolveMongoConfig().database;
  if (
    execute &&
    configuredDatabase !== targetDatabase &&
    process.env.NODE_TEST_ENV !== "true"
  ) {
    throw new StagingHistoricalMediaError(
      `Refusing execute: MONGODB_DATABASE logical name "${configuredDatabase}" must equal target "${targetDatabase}".`,
    );
  }

  // Dry-run may use whatever provider is configured for URL planning;
  // execute path already requires R2 (unless test memory).
  const storage = resolveMediaObjectStorage();

  await connectMongoClient();
  try {
    const client = getMongoClient();
    const plan = await loadTargetMediaContext({
      client,
      targetDatabase,
      portable,
      storage,
    });

    const planOut =
      parseArg("plan-out") ??
      path.join(repoRoot, "architecture/recovery/STAGING_MEDIA_RECOVERY_DRY_RUN_PLAN_v1.0.json");
    fs.mkdirSync(path.dirname(planOut), { recursive: true });
    fs.writeFileSync(planOut, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          dryRunPlanPath: path.relative(repoRoot, planOut),
          initiatives: plan.initiatives.map((item) => ({
            initiativeId: item.initiativeId,
            title: item.title,
            sourceFilename: item.sourceFilename,
            destinationObjectKey: item.destinationObjectKey,
            currentImageUrl: item.currentImageUrl,
            plannedPublicUrl: item.plannedPublicUrl,
            action: item.action,
          })),
          avatars: plan.avatars.map((item) => ({
            key: item.key,
            displayName: item.displayName,
            sourceFilename: item.sourceFilename,
            destinationObjectKey: item.destinationObjectKey,
            currentAvatarUrl: item.currentAvatarUrl,
            plannedPublicUrl: item.plannedPublicUrl,
            action: item.action,
          })),
          summary: plan.summary,
          conflicts: plan.conflicts,
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
              : "DRY RUN COMPLETE — NO UPLOADS, UPDATES, OR DELETES WERE PERFORMED.",
          conflictCount: plan.conflicts.length,
        }),
      );
      if (plan.conflicts.length > 0) {
        process.exitCode = 2;
      }
      return;
    }

    const writeSummary = await executeStagingHistoricalMediaMigration({
      client,
      targetDatabase,
      portable,
      storage,
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
