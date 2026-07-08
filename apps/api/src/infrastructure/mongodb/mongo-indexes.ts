import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "./mongo-collections.js";
import { ensureCollectionIndexes } from "./mongo-snapshot-store.js";

const MODULE_INDEXES: ReadonlyArray<{
  collectionName: string;
  indexes: IndexDescription[];
}> = [
  {
    collectionName: MONGO_COLLECTIONS.initiatives,
    indexes: [{ key: { stewardId: 1 } }, { key: { status: 1 } }, { key: { updatedAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeAnalyses,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImprovementProposals,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeVersionRevisions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeRevisionDrafts,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.decisionSessions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { stewardId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeCollectiveDecisions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { stewardId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVotes,
    indexes: [{ key: { decisionId: 1 } }, { key: { participantId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    indexes: [{ key: { decisionId: 1 } }, { key: { participantId: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.participationAreas,
    indexes: [{ key: { participantId: 1 } }, { key: { communitySlug: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.participationAreaTransitions,
    indexes: [{ key: { participantId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicActionPackages,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { capId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicDeliveries,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicDeliveryRecipients,
    indexes: [{ key: { deliveryId: 1 } }, { key: { capId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.officialResponses,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { deliveryId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.officialResponseIdentities,
    indexes: [{ key: { capId: 1 } }, { key: { updatedAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicAccountabilities,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicAccountabilityEvents,
    indexes: [
      { key: { accountabilityId: 1 } },
      { key: { recordedByParticipantId: 1 } },
      { key: { occurredAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImplementationCommitments,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImplementationTrackings,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { commitmentId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.implementationTrackingUpdates,
    indexes: [{ key: { trackingId: 1 } }, { key: { authorId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativePublicImpacts,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { trackingId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicImpactEvidence,
    indexes: [{ key: { impactId: 1 } }, { key: { authorId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicCivicArchiveRecords,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { impactId: 1 } },
      { key: { stewardId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicCompatibilityReviews,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { requestedByStewardId: 1 } },
      { key: { generatedAt: -1 } },
    ],
  },
];

export async function ensureMongoIndexes(): Promise<void> {
  for (const entry of MODULE_INDEXES) {
    await ensureCollectionIndexes(entry.collectionName, entry.indexes);
  }
}
