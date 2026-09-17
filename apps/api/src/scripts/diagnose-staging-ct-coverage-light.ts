/**
 * Lightweight READ-ONLY CT coverage diagnostic for staging.
 *
 * Usage:
 *   NODE_ENV=production MONGODB_DATABASE=humanity_union_staging \
 *     pnpm --filter @hu/api diagnose:ct-coverage-light
 *
 * Aggregation / scalar output only. Does not hydrate localization corpus,
 * warm translations, call TranslationProvider, or write Mongo.
 */

import type { Document } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured, resolveMongoConfig } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import {
  assertCtCoverageLightSafetyGate,
  buildCanonicalEligibleCharsPipeline,
  buildCanonicalKindMeasurePlans,
  buildContentTranslationStatusCountsPipeline,
  buildCoverageRows,
  buildCurrentTranslatedCharactersPipeline,
  CT_COVERAGE_LIGHT_TARGET_LANGUAGES,
  formatCtCoverageLightReport,
  type CanonicalMeasureResult,
  type CtCharBucket,
  type CtCountBucket,
} from "./diagnose-staging-ct-coverage-light.logic.js";

async function aggregateScalars(
  collectionName: string,
  pipeline: Document[],
): Promise<Document[]> {
  const collection = getMongoCollection(collectionName);
  // Bounded: pipelines return only grouped scalars / tiny result sets.
  return collection.aggregate(pipeline).toArray();
}

async function runDiagnostic(): Promise<number> {
  loadApiEnvironment();

  const config = resolveMongoConfig();
  const gate = assertCtCoverageLightSafetyGate({
    nodeEnv: process.env.NODE_ENV,
    mongoDatabase: process.env.MONGODB_DATABASE ?? config.database,
  });
  if (!gate.ok) {
    console.error(gate.refusalMessage);
    return 1;
  }

  // Re-check after env load: never proceed if database drifted.
  if (config.database !== "humanity_union_staging") {
    console.error(
      `REFUSED: resolveMongoConfig().database must be humanity_union_staging (got ${config.database}).`,
    );
    return 1;
  }

  if (!isMongoConfigured()) {
    console.error("REFUSED: MONGODB_URI is not configured.");
    return 1;
  }

  await connectMongoClient();

  const countsRaw = await aggregateScalars(
    MONGO_COLLECTIONS.contentTranslations,
    buildContentTranslationStatusCountsPipeline([...CT_COVERAGE_LIGHT_TARGET_LANGUAGES]),
  );
  const counts: CtCountBucket[] = countsRaw.map((row) => ({
    targetLanguage: String(row.targetLanguage ?? ""),
    sourceKind: String(row.sourceKind ?? ""),
    current: Number(row.current ?? 0),
    stale: Number(row.stale ?? 0),
    other: Number(row.other ?? 0),
  }));

  const charBuckets: CtCharBucket[] = [];
  for (const targetLanguage of CT_COVERAGE_LIGHT_TARGET_LANGUAGES) {
    // One language at a time; group by sourceKind — scalars only.
    const rows = await aggregateScalars(
      MONGO_COLLECTIONS.contentTranslations,
      buildCurrentTranslatedCharactersPipeline({
        targetLanguage,
      }),
    );
    for (const row of rows) {
      charBuckets.push({
        targetLanguage,
        sourceKind: String(row.sourceKind ?? ""),
        currentRecords: Number(row.currentRecords ?? 0),
        translatedCharacters: Number(row.translatedCharacters ?? 0),
      });
    }
  }

  const plans = buildCanonicalKindMeasurePlans();
  const canonical: CanonicalMeasureResult[] = [];
  for (const plan of plans) {
    if (plan.status === "UNMEASURED") {
      canonical.push({
        sourceKind: plan.sourceKind,
        status: "UNMEASURED",
        reason: plan.reason,
      });
      continue;
    }

    const pipeline = buildCanonicalEligibleCharsPipeline({
      match: plan.match ?? {},
      allowlistedFields: plan.allowlistedFields ?? [],
    });
    const rows = await aggregateScalars(plan.collectionName!, pipeline);
    const row = rows[0];
    canonical.push({
      sourceKind: plan.sourceKind,
      status: "measured",
      eligibleRecords: Number(row?.eligibleRecords ?? 0),
      eligibleCharacters: Number(row?.eligibleCharacters ?? 0),
    });
  }

  const coverage = buildCoverageRows({ counts, canonical });

  console.log(
    formatCtCoverageLightReport({
      database: config.database,
      targetLanguages: [...CT_COVERAGE_LIGHT_TARGET_LANGUAGES],
      counts,
      charBuckets,
      canonical,
      coverage,
    }),
  );

  return 0;
}

async function main(): Promise<void> {
  try {
    const code = await runDiagnostic();
    process.exitCode = code;
  } catch (error) {
    console.error(
      JSON.stringify({
        operation: "diagnose_ct_coverage_light",
        fatal: true,
        errorName: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    process.exitCode = 1;
  } finally {
    try {
      await disconnectMongoClient();
    } catch {
      // ignore disconnect errors
    }
    process.exit(process.exitCode ?? 0);
  }
}

void main();
