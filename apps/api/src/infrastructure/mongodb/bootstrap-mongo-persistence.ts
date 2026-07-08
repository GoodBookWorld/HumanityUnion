import { assertMongoConfigured } from "./mongo-config.js";
import { connectMongoClient } from "./mongo-connection.js";
import { ensureMongoIndexes } from "./mongo-indexes.js";
import { hydrateCivicAccountabilityMongoPersistence } from "../../modules/civic-accountability/persistence/civic-accountability-mongo.persistence.js";
import { hydrateCivicActionPackageMongoPersistence } from "../../modules/civic-action-package/persistence/civic-action-package-mongo.persistence.js";
import { hydrateCivicCompatibilityReviewMongoPersistence } from "../../modules/civic-compatibility-review/persistence/civic-compatibility-review-mongo.persistence.js";
import { hydrateCivicDeliveryMongoPersistence } from "../../modules/civic-delivery/persistence/civic-delivery-mongo.persistence.js";
import { hydrateDecisionSessionMongoPersistence } from "../../modules/decision-session/persistence/decision-session-mongo.persistence.js";
import { hydrateInitiativeCollaborativeAnalysisMongoPersistence } from "../../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js";
import { hydrateInitiativeCollectiveDecisionMongoPersistence } from "../../modules/initiative-collective-decision/persistence/initiative-collective-decision-mongo.persistence.js";
import { hydrateInitiativeDecisionVoteMongoPersistence } from "../../modules/initiative-decision-vote/persistence/initiative-decision-vote-mongo.persistence.js";
import { hydrateInitiativeImplementationCommitmentMongoPersistence } from "../../modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js";
import { hydrateInitiativeImplementationTrackingMongoPersistence } from "../../modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js";
import { hydrateInitiativeImprovementProposalMongoPersistence } from "../../modules/initiative-improvement-proposal/persistence/initiative-improvement-proposal-mongo.persistence.js";
import { hydrateInitiativePublicImpactMongoPersistence } from "../../modules/initiative-public-impact/persistence/initiative-public-impact-mongo.persistence.js";
import { hydrateInitiativeVersionRevisionMongoPersistence } from "../../modules/initiative-version-revision/persistence/initiative-version-revision-mongo.persistence.js";
import { hydrateInitiativeMongoPersistence } from "../../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { hydrateOfficialResponseMongoPersistence } from "../../modules/official-response/persistence/official-response-mongo.persistence.js";
import { hydrateParticipationAreaMongoPersistence } from "../../modules/participation-area/persistence/participation-area-mongo.persistence.js";
import { hydratePublicCivicArchiveMongoPersistence } from "../../modules/public-civic-archive/persistence/public-civic-archive-mongo.persistence.js";

const PERSISTENCE_ENV_KEYS = [
  "INITIATIVE_PERSISTENCE",
  "INITIATIVE_ANALYSIS_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE",
  "INITIATIVE_VERSION_REVISION_PERSISTENCE",
  "DECISION_SESSION_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE",
  "INITIATIVE_DECISION_VOTE_PERSISTENCE",
  "PARTICIPATION_AREA_PERSISTENCE",
  "CIVIC_ACTION_PACKAGE_PERSISTENCE",
  "CIVIC_DELIVERY_PERSISTENCE",
  "OFFICIAL_RESPONSE_PERSISTENCE",
  "CIVIC_ACCOUNTABILITY_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_PERSISTENCE",
  "PUBLIC_CIVIC_ARCHIVE_PERSISTENCE",
  "CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE",
] as const;

export function isAnyMongoPersistenceSelected(): boolean {
  return PERSISTENCE_ENV_KEYS.some((key) => process.env[key] === "mongodb");
}

/**
 * Connects to MongoDB, ensures indexes, and hydrates module caches before stores load.
 * No-op when no module selects mongodb persistence.
 */
export async function bootstrapMongoPersistence(): Promise<void> {
  if (!isAnyMongoPersistenceSelected()) {
    return;
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();

  await Promise.all([
    hydrateInitiativeMongoPersistence(),
    hydrateInitiativeCollaborativeAnalysisMongoPersistence(),
    hydrateInitiativeImprovementProposalMongoPersistence(),
    hydrateInitiativeVersionRevisionMongoPersistence(),
    hydrateDecisionSessionMongoPersistence(),
    hydrateInitiativeCollectiveDecisionMongoPersistence(),
    hydrateInitiativeDecisionVoteMongoPersistence(),
    hydrateParticipationAreaMongoPersistence(),
    hydrateCivicActionPackageMongoPersistence(),
    hydrateCivicDeliveryMongoPersistence(),
    hydrateOfficialResponseMongoPersistence(),
    hydrateCivicAccountabilityMongoPersistence(),
    hydrateInitiativeImplementationCommitmentMongoPersistence(),
    hydrateInitiativeImplementationTrackingMongoPersistence(),
    hydrateInitiativePublicImpactMongoPersistence(),
    hydratePublicCivicArchiveMongoPersistence(),
    hydrateCivicCompatibilityReviewMongoPersistence(),
  ]);
}
