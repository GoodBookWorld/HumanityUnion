/**
 * Temporary READ-ONLY Georgian residual identity diagnostic.
 *
 * Render STAGING API Shell (image workdir /app/apps/api):
 *   node dist/scripts/diagnose-ka-residual-identities.js
 *
 * Hard-bounded to locale ka and eight activation source kinds.
 * Uses discoverStagingInitiativePathWarmSources, loadTranslatableSource,
 * and buildPublicLocalizationRetryPreflight.
 *
 * Does not activate, refresh activation status, enqueue, seed, or call a provider.
 * HU_READ_ONLY_DIAGNOSTIC=1 makes those write paths throw.
 */

import { HU_READ_ONLY_DIAGNOSTIC_ENV } from "../modules/language/read-only-diagnostic-guard.js";
import {
  KA_RESIDUAL_DIAGNOSTIC_KINDS,
  KA_RESIDUAL_DIAGNOSTIC_LOCALE,
  assertKaResidualDiagnosticSafetyGate,
  classifyKaResidualIdentity,
  emptyKaResidualKindCounts,
  isKaResidualDiagnosticKind,
  sumKaResidualCounts,
  type KaResidualDiagnosticKind,
  type KaResidualKindCounts,
} from "./diagnose-ka-residual-identities.logic.js";

process.env[HU_READ_ONLY_DIAGNOSTIC_ENV] = "1";

function refuseArguments(): boolean {
  const args = process.argv.slice(2).filter((arg) => arg !== "--help" && arg !== "-h");
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(
      [
        "diagnose-ka-residual-identities",
        "Read-only. No arguments.",
        `Locale is fixed to ${KA_RESIDUAL_DIAGNOSTIC_LOCALE}.`,
        `Kinds: ${KA_RESIDUAL_DIAGNOSTIC_KINDS.join(", ")}`,
        "Render STAGING API Shell: node dist/scripts/diagnose-ka-residual-identities.js",
      ].join("\n"),
    );
    return true;
  }
  if (args.length > 0) {
    console.error(
      "REFUSED: this diagnostic accepts no locale or kind arguments. It is hard-bounded to ka and the eight listed kinds.",
    );
    process.exitCode = 1;
    return true;
  }
  return false;
}

async function main(): Promise<number> {
  if (refuseArguments()) {
    return process.exitCode === 1 ? 1 : 0;
  }

  const { loadApiEnvironment } = await import("../config/load-api-environment.js");
  loadApiEnvironment();
  process.env[HU_READ_ONLY_DIAGNOSTIC_ENV] = "1";

  const { resolveMongoConfig, isMongoConfigured } = await import(
    "../infrastructure/mongodb/mongo-config.js"
  );
  const config = resolveMongoConfig();
  const gate = assertKaResidualDiagnosticSafetyGate({
    nodeEnv: process.env.NODE_ENV,
    mongoDatabase: process.env.MONGODB_DATABASE ?? config.database,
    readOnlyFlag: process.env[HU_READ_ONLY_DIAGNOSTIC_ENV],
  });
  if (!gate.ok) {
    console.error(gate.refusalMessage);
    return 1;
  }
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

  const { connectMongoClient, disconnectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  await connectMongoClient();

  try {
    const { hydrateInitiativeMongoPersistence } = await import(
      "../modules/initiatives/persistence/initiative-mongo.persistence.js"
    );
    const { hydrateInitiativeVersionRevisionMongoPersistence } = await import(
      "../modules/initiative-version-revision/persistence/initiative-version-revision-mongo.persistence.js"
    );
    const { hydrateDecisionSessionMongoPersistence } = await import(
      "../modules/decision-session/persistence/decision-session-mongo.persistence.js"
    );
    const { hydrateInitiativeCollectiveDecisionMongoPersistence } = await import(
      "../modules/initiative-collective-decision/persistence/initiative-collective-decision-mongo.persistence.js"
    );
    const { hydrateInitiativeImplementationCommitmentMongoPersistence } = await import(
      "../modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js"
    );
    const { hydrateInitiativeImplementationTrackingMongoPersistence } = await import(
      "../modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js"
    );

    await hydrateInitiativeMongoPersistence();
    await hydrateInitiativeVersionRevisionMongoPersistence();
    await hydrateDecisionSessionMongoPersistence();
    await hydrateInitiativeCollectiveDecisionMongoPersistence();
    await hydrateInitiativeImplementationCommitmentMongoPersistence();
    await hydrateInitiativeImplementationTrackingMongoPersistence();

    const { discoverStagingInitiativePathWarmSources } = await import(
      "../modules/language/content-translation-staging-warm-backfill.js"
    );
    const { buildPublicLocalizationRetryPreflight } = await import(
      "../modules/language/public-localization-retry-preflight.js"
    );
    const { loadTranslatableSource } = await import(
      "../modules/language/content-translation.service.js"
    );
    const { MONGO_COLLECTIONS } = await import(
      "../infrastructure/mongodb/mongo-collections.js"
    );
    const { getMongoCollection } = await import(
      "../infrastructure/mongodb/mongo-database.js"
    );

    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: [...KA_RESIDUAL_DIAGNOSTIC_KINDS],
    });

    const counts = new Map<KaResidualDiagnosticKind, KaResidualKindCounts>(
      KA_RESIDUAL_DIAGNOSTIC_KINDS.map((kind) => [kind, emptyKaResidualKindCounts()]),
    );
    const blocked: Array<{
      sourceKind: KaResidualDiagnosticKind;
      sourceRecordId: string;
      failureReason: string;
      sourceVersionAssociation: "associated" | "absent";
    }> = [];

    const translations = getMongoCollection(MONGO_COLLECTIONS.contentTranslations);

    for (const candidate of discovered.candidates) {
      if (!isKaResidualDiagnosticKind(candidate.sourceKind)) {
        console.error(
          `REFUSED: discovery returned sourceKind outside the eight-kind bound: ${candidate.sourceKind}`,
        );
        return 1;
      }
      const bucketCounts = counts.get(candidate.sourceKind);
      if (!bucketCounts) {
        return 1;
      }
      bucketCounts.liveEligible += 1;

      const source = await loadTranslatableSource({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
      });
      const liveVersion = source?.sourceVersion ?? null;

      const versionRows = await translations
        .find(
          {
            sourceKind: candidate.sourceKind,
            sourceRecordId: candidate.sourceRecordId,
            targetLanguage: KA_RESIDUAL_DIAGNOSTIC_LOCALE,
          },
          { projection: { sourceVersion: 1, freshness: 1, stale: 1, _id: 0 } },
        )
        .limit(20)
        .toArray();

      const liveRow = liveVersion
        ? versionRows.find((row) => row.sourceVersion === liveVersion)
        : undefined;
      const liveCurrent = Boolean(
        liveRow && liveRow.freshness === "current" && liveRow.stale !== true,
      );
      const liveStale = Boolean(
        liveRow && (liveRow.stale === true || liveRow.freshness === "stale"),
      );
      const historicalStale = versionRows.some(
        (row) =>
          row.sourceVersion !== liveVersion &&
          (row.stale === true || row.freshness === "stale"),
      );

      const preflight = await buildPublicLocalizationRetryPreflight({
        workItem: {
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          sourceVersion: liveVersion ?? "unloaded",
          targetLanguage: KA_RESIDUAL_DIAGNOSTIC_LOCALE,
          state: "MISSING",
          autoNodeCount: 0,
          missingOrStaleNodeCount: 0,
          fallbackPaths: [],
        },
      });

      const bucket = classifyKaResidualIdentity({
        liveCurrent,
        liveStale,
        preflightReady: preflight.ready,
        readyState: preflight.readyState,
        terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
      });
      bucketCounts[bucket] += 1;
      if (liveCurrent && historicalStale) {
        bucketCounts.historicalStaleButLiveCurrent += 1;
      }
      if (bucket === "blockedFailedAttempt") {
        blocked.push({
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          failureReason: preflight.failureReasonCode ?? "unspecified",
          sourceVersionAssociation: preflight.attemptSourceVersion
            ? "associated"
            : "absent",
        });
      }
    }

    const ordered = KA_RESIDUAL_DIAGNOSTIC_KINDS.map(
      (kind) => counts.get(kind) ?? emptyKaResidualKindCounts(),
    );
    const totals = sumKaResidualCounts(ordered);
    const collective = counts.get("collective_decision") ?? emptyKaResidualKindCounts();
    const collectiveLiveRefresh =
      collective.retryReadyMissing +
      collective.retryReadyStale +
      collective.blockedFailedAttempt;

    console.log(`locale=${KA_RESIDUAL_DIAGNOSTIC_LOCALE}`);
    console.log(`kinds=${KA_RESIDUAL_DIAGNOSTIC_KINDS.join(",")}`);
    for (const kind of KA_RESIDUAL_DIAGNOSTIC_KINDS) {
      const row = counts.get(kind) ?? emptyKaResidualKindCounts();
      console.log(
        [
          `kind=${kind}`,
          `liveEligible=${row.liveEligible}`,
          `currentExactLiveVersion=${row.currentExactLiveVersion}`,
          `retryReadyMissing=${row.retryReadyMissing}`,
          `retryReadyStale=${row.retryReadyStale}`,
          `blockedFailedAttempt=${row.blockedFailedAttempt}`,
          `sourceOrPreflightBlocked=${row.sourceOrPreflightBlocked}`,
          `historicalStaleButLiveCurrent=${row.historicalStaleButLiveCurrent}`,
        ].join(" "),
      );
    }
    console.log(
      [
        "totals",
        `liveEligible=${totals.liveEligible}`,
        `currentExactLiveVersion=${totals.currentExactLiveVersion}`,
        `retryReadyMissing=${totals.retryReadyMissing}`,
        `retryReadyStale=${totals.retryReadyStale}`,
        `blockedFailedAttempt=${totals.blockedFailedAttempt}`,
        `sourceOrPreflightBlocked=${totals.sourceOrPreflightBlocked}`,
        `historicalStaleButLiveCurrent=${totals.historicalStaleButLiveCurrent}`,
      ].join(" "),
    );
    console.log(
      `collectiveDecisionLiveRefreshRequired=${collectiveLiveRefresh}`,
    );
    console.log(
      `collectiveDecisionHistoricalStaleButLiveCurrent=${collective.historicalStaleButLiveCurrent}`,
    );
    const absentAssociations = blocked.filter(
      (row) => row.sourceVersionAssociation === "absent",
    ).length;
    console.log(
      `failedAttemptSourceVersionAssociation absent=${absentAssociations} associated=${blocked.length - absentAssociations}`,
    );
    if (blocked.length === 0) {
      console.log("blockedFailedAttempt rows=0");
    }
    for (const row of blocked) {
      console.log(
        `blockedFailedAttempt sourceKind=${row.sourceKind} sourceRecordId=${row.sourceRecordId} failureReason=${row.failureReason} sourceVersionAssociation=${row.sourceVersionAssociation}`,
      );
    }
    console.log("PROVIDER_CALLS=0");
    console.log("WRITES=0");
    return 0;
  } finally {
    await disconnectMongoClient();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "diagnostic failed";
    console.error(message.startsWith("REFUSED:") ? message : `REFUSED: ${message}`);
    process.exitCode = 1;
  });
