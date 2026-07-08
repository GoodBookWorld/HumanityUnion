/**
 * TASK-050 / TASK-051B — MongoDB persistence verification.
 * Run: npm run verify:mongodb
 */

import type { Initiative } from "@hu/types";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import { checkMongoConnection } from "../infrastructure/mongodb/mongo-health.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { ensureMongoIndexes } from "../infrastructure/mongodb/mongo-indexes.js";
import {
  countCollectionDocuments,
  deleteRecordsByIdPrefix,
  findOneById,
  loadRecordMap,
  replaceRecordMap,
} from "../infrastructure/mongodb/mongo-snapshot-store.js";
import {
  createMongoInitiativePersistenceAdapter,
  flushInitiativeMongoPersistence,
  hydrateInitiativeMongoPersistence,
} from "../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { createEmptyInitiativePersistenceSnapshot } from "../modules/initiatives/persistence/initiative-persistence.types.js";

import {
  createMongoOfficialResponsePersistenceAdapter,
  flushOfficialResponseMongoPersistence,
  hydrateOfficialResponseMongoPersistence,
} from "../modules/official-response/persistence/official-response-mongo.persistence.js";
import { createEmptyOfficialResponsePersistenceSnapshot } from "../modules/official-response/persistence/official-response-persistence.types.js";

const TEST_PREFIX = `mongo-verify-${Date.now()}-`;
const VERIFY_COLLECTION = "mongo_verify_foundation";

const ALL_MODULE_COLLECTIONS = [
  MONGO_COLLECTIONS.initiatives,
  MONGO_COLLECTIONS.initiativeAnalyses,
  MONGO_COLLECTIONS.initiativeImprovementProposals,
  MONGO_COLLECTIONS.initiativeVersionRevisions,
  MONGO_COLLECTIONS.initiativeRevisionDrafts,
  MONGO_COLLECTIONS.decisionSessions,
  MONGO_COLLECTIONS.initiativeCollectiveDecisions,
  MONGO_COLLECTIONS.initiativeDecisionVotes,
  MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
  MONGO_COLLECTIONS.participationAreas,
  MONGO_COLLECTIONS.participationAreaTransitions,
  MONGO_COLLECTIONS.civicActionPackages,
  MONGO_COLLECTIONS.civicDeliveries,
  MONGO_COLLECTIONS.civicDeliveryRecipients,
  MONGO_COLLECTIONS.officialResponses,
  MONGO_COLLECTIONS.officialResponseIdentities,
  MONGO_COLLECTIONS.civicAccountabilities,
  MONGO_COLLECTIONS.civicAccountabilityEvents,
  MONGO_COLLECTIONS.initiativeImplementationCommitments,
  MONGO_COLLECTIONS.initiativeImplementationTrackings,
  MONGO_COLLECTIONS.implementationTrackingUpdates,
  MONGO_COLLECTIONS.initiativePublicImpacts,
  MONGO_COLLECTIONS.publicImpactEvidence,
  MONGO_COLLECTIONS.publicCivicArchiveRecords,
  MONGO_COLLECTIONS.civicCompatibilityReviews,
] as const;

interface VerifyRecord {
  verifyId: string;
  label: string;
  status: string;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createTestInitiative(initiativeId: string): Initiative {
  const timestamp = new Date().toISOString();

  return {
    initiativeId,
    stewardId: "member-verify-steward",
    createdAt: timestamp,
    updatedAt: timestamp,
    title: "Mongo Verify Initiative",
    description: "Persistence verification record.",
    status: "draft",
    lifecyclePhase: "draft",
    visibility: { policy: "steward_only" },
    metadata: {
      category: "verification",
      tags: ["mongodb"],
      region: "verify",
      language: "en",
      communitySlug: "verify-community",
      activityArea: "infrastructure",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

async function verifySnapshotStorePrimitives(): Promise<void> {
  const recordId = `${TEST_PREFIX}snapshot-1`;
  const records: Record<string, VerifyRecord> = {
    [recordId]: {
      verifyId: recordId,
      label: "initial",
      status: "active",
    },
  };

  await replaceRecordMap(VERIFY_COLLECTION, records, "verifyId");

  const loaded = await loadRecordMap<VerifyRecord>(VERIFY_COLLECTION, "verifyId");
  assert(loaded[recordId]?.label === "initial", "loadRecordMap failed after insert");

  records[recordId] = {
    verifyId: recordId,
    label: "updated",
    status: "active",
  };
  await replaceRecordMap(VERIFY_COLLECTION, records, "verifyId");

  const updated = await loadRecordMap<VerifyRecord>(VERIFY_COLLECTION, "verifyId");
  assert(updated[recordId]?.label === "updated", "replaceRecordMap failed to update");

  const found = await findOneById<VerifyRecord & { _id: string }>(VERIFY_COLLECTION, recordId);
  assert(found?.label === "updated", "findOneById failed after update");

  const listCount = await countCollectionDocuments(VERIFY_COLLECTION);
  assert(listCount === 1, "countCollectionDocuments returned unexpected value");

  await replaceRecordMap(VERIFY_COLLECTION, {}, "verifyId");
  assert((await countCollectionDocuments(VERIFY_COLLECTION)) === 0, "delete via empty map failed");
}

async function verifyCollectionRoundTrip(
  collectionName: string,
  idField: string,
  suffix: string,
): Promise<void> {
  const recordId = `${TEST_PREFIX}${suffix}`;
  const records: Record<string, Record<string, string>> = {
    [recordId]: {
      [idField]: recordId,
      status: "initial",
    },
  };

  await replaceRecordMap(collectionName, records, idField);
  const loaded = await loadRecordMap<Record<string, string>>(collectionName, idField);
  assert(loaded[recordId]?.status === "initial", `${collectionName} initial load failed`);

  records[recordId] = {
    ...loaded[recordId],
    status: "updated",
  };
  await replaceRecordMap(collectionName, records, idField);

  const reloaded = await loadRecordMap<Record<string, string>>(collectionName, idField);
  assert(reloaded[recordId]?.status === "updated", `${collectionName} update reload failed`);

  await deleteRecordsByIdPrefix(collectionName, TEST_PREFIX);
  assert(
    (await countCollectionDocuments(collectionName)) === 0,
    `${collectionName} cleanup failed`,
  );
}

async function verifyInitiativeAdapterRoundTrip(): Promise<void> {
  process.env.INITIATIVE_PERSISTENCE = "mongodb";

  await hydrateInitiativeMongoPersistence();
  const adapter = createMongoInitiativePersistenceAdapter();
  assert(adapter.mode === "mongodb", "initiative adapter mode must be mongodb");

  const initiativeId = `${TEST_PREFIX}initiative`;
  const snapshot = createEmptyInitiativePersistenceSnapshot();
  snapshot.initiatives[initiativeId] = createTestInitiative(initiativeId);
  adapter.save(snapshot);
  await flushInitiativeMongoPersistence();

  await hydrateInitiativeMongoPersistence();
  const loaded = adapter.load();
  assert(
    loaded.initiatives[initiativeId]?.title === "Mongo Verify Initiative",
    "initiative reload failed",
  );

  loaded.initiatives[initiativeId] = {
    ...loaded.initiatives[initiativeId],
    title: "Mongo Verify Initiative Updated",
    updatedAt: new Date().toISOString(),
  };
  adapter.save(loaded);
  await flushInitiativeMongoPersistence();

  await hydrateInitiativeMongoPersistence();
  assert(
    adapter.load().initiatives[initiativeId]?.title === "Mongo Verify Initiative Updated",
    "initiative update reload failed",
  );

  await deleteRecordsByIdPrefix(MONGO_COLLECTIONS.initiatives, TEST_PREFIX);
}

async function verifyPriorityModuleCollections(): Promise<void> {
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.initiativeAnalyses, "analysisId", "analysis");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeImprovementProposals,
    "proposalId",
    "proposal",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeVersionRevisions,
    "revisionId",
    "revision",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeRevisionDrafts,
    "initiativeId",
    "draft-initiative",
  );
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.decisionSessions, "sessionId", "session");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeCollectiveDecisions,
    "decisionId",
    "decision",
  );
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.initiativeDecisionVotes, "voteId", "vote");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    "historyId",
    "history",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.participationAreas,
    "participationAreaId",
    "area",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.participationAreaTransitions,
    "transitionId",
    "transition",
  );
}

async function verifyPipelineModuleCollections(): Promise<void> {
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.civicActionPackages, "capId", "cap");
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.civicDeliveries, "deliveryId", "delivery");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.civicDeliveryRecipients,
    "recipientId",
    "recipient",
  );
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.officialResponses, "responseId", "response");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.officialResponseIdentities,
    "capId",
    "response-identity",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.civicAccountabilities,
    "accountabilityId",
    "accountability",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.civicAccountabilityEvents,
    "eventId",
    "accountability-event",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeImplementationCommitments,
    "commitmentId",
    "commitment",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.initiativeImplementationTrackings,
    "trackingId",
    "tracking",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.implementationTrackingUpdates,
    "updateId",
    "tracking-update",
  );
  await verifyCollectionRoundTrip(MONGO_COLLECTIONS.initiativePublicImpacts, "impactId", "impact");
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.publicImpactEvidence,
    "evidenceId",
    "impact-evidence",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.publicCivicArchiveRecords,
    "archiveRecordId",
    "archive",
  );
  await verifyCollectionRoundTrip(
    MONGO_COLLECTIONS.civicCompatibilityReviews,
    "reviewId",
    "compatibility-review",
  );
}

async function verifyOfficialResponseAdapterRoundTrip(): Promise<void> {
  process.env.OFFICIAL_RESPONSE_PERSISTENCE = "mongodb";

  await hydrateOfficialResponseMongoPersistence();
  const adapter = createMongoOfficialResponsePersistenceAdapter();
  assert(adapter.mode === "mongodb", "official response adapter mode must be mongodb");

  const responseId = `${TEST_PREFIX}response`;
  const capId = `${TEST_PREFIX}cap`;
  const snapshot = createEmptyOfficialResponsePersistenceSnapshot();
  snapshot.responses[responseId] = {
    responseId,
    responseNumber: "RESP-2026-000001",
    capId,
    initiativeId: `${TEST_PREFIX}initiative`,
    decisionId: `${TEST_PREFIX}decision`,
    deliveryId: `${TEST_PREFIX}delivery`,
    recipientId: `${TEST_PREFIX}recipient`,
    organizationName: "Verify Org",
    recordedByParticipantId: "member-verify",
    receivedAt: new Date().toISOString(),
    subject: "Verify",
    summary: "Verify summary",
    responseReference: "REF-VERIFY",
    responseType: "official_letter",
    publicationStatus: "published",
    verificationState: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  snapshot.identities[capId] = {
    capId,
    replyIdentifier: `CAP-${capId}`,
    createdAt: new Date().toISOString(),
  };
  snapshot.responseSequence = 1;
  snapshot.responseSequenceYear = new Date().getFullYear();

  adapter.save(snapshot);
  await flushOfficialResponseMongoPersistence();

  await hydrateOfficialResponseMongoPersistence();
  const loaded = adapter.load();
  assert(
    loaded.responses[responseId]?.summary === "Verify summary",
    "official response reload failed",
  );
  assert(loaded.identities[capId]?.replyIdentifier === `CAP-${capId}`, "identity reload failed");
  assert(loaded.responseSequence === 1, "response sequence reload failed");

  loaded.responses[responseId] = {
    ...loaded.responses[responseId],
    summary: "Verify summary updated",
    updatedAt: new Date().toISOString(),
  };
  adapter.save(loaded);
  await flushOfficialResponseMongoPersistence();

  await hydrateOfficialResponseMongoPersistence();
  assert(
    adapter.load().responses[responseId]?.summary === "Verify summary updated",
    "official response update reload failed",
  );

  await deleteRecordsByIdPrefix(MONGO_COLLECTIONS.officialResponses, TEST_PREFIX);
  await deleteRecordsByIdPrefix(MONGO_COLLECTIONS.officialResponseIdentities, TEST_PREFIX);
}

async function cleanupVerifyArtifacts(): Promise<void> {
  await deleteRecordsByIdPrefix(VERIFY_COLLECTION, TEST_PREFIX);

  for (const collectionName of ALL_MODULE_COLLECTIONS) {
    await deleteRecordsByIdPrefix(collectionName, TEST_PREFIX);
  }
}

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    console.log("SKIP: MONGODB_URI is not configured.");
    return;
  }

  await connectMongoClient();

  try {
    const health = await checkMongoConnection();
    assert(health.connected, `Mongo health check failed: ${health.error ?? "unknown error"}`);
    console.log(`OK: MongoDB connected (${health.database}, ${health.latencyMs}ms)`);

    await ensureMongoIndexes();
    console.log("OK: MongoDB indexes ensured");

    await verifySnapshotStorePrimitives();
    console.log("OK: snapshot store insert/read/update/list/delete");

    await verifyInitiativeAdapterRoundTrip();
    console.log("OK: initiative adapter round-trip");

    await verifyPriorityModuleCollections();
    console.log("OK: priority module collection round-trips");

    await verifyPipelineModuleCollections();
    console.log("OK: pipeline module collection round-trips");

    await verifyOfficialResponseAdapterRoundTrip();
    console.log("OK: official response adapter round-trip");

    console.log("MongoDB verification passed.");
  } finally {
    await cleanupVerifyArtifacts();
    await disconnectMongoClient();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
