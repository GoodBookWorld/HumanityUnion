import { shouldBootstrapMongoPersistence } from "../../config/production-persistence-contract.js";
import { hydrateCivicAccountabilityMongoPersistence } from "../../modules/civic-accountability/persistence/civic-accountability-mongo.persistence.js";
import { hydrateCivicActionPackageMongoPersistence } from "../../modules/civic-action-package/persistence/civic-action-package-mongo.persistence.js";
import { hydrateCivicCompatibilityReviewMongoPersistence } from "../../modules/civic-compatibility-review/persistence/civic-compatibility-review-mongo.persistence.js";
import { hydrateCivicDeliveryMongoPersistence } from "../../modules/civic-delivery/persistence/civic-delivery-mongo.persistence.js";
import { hydrateCivicNominationMongoPersistence } from "../../modules/civic-nomination/persistence/civic-nomination-mongo.persistence.js";
import { hydrateCivicNominationVoteMongoPersistence } from "../../modules/civic-nomination-vote/persistence/civic-nomination-vote-mongo.persistence.js";
import { hydrateDecisionSessionMongoPersistence } from "../../modules/decision-session/persistence/decision-session-mongo.persistence.js";
import { hydrateInitiativeCollaborativeAnalysisMongoPersistence } from "../../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js";
import { hydrateInitiativeCollectiveDecisionMongoPersistence } from "../../modules/initiative-collective-decision/persistence/initiative-collective-decision-mongo.persistence.js";
import { hydrateInitiativeCollectiveDecisionLifecycleDraftMongoPersistence } from "../../modules/initiative-collective-decision-lifecycle/persistence/initiative-collective-decision-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativeCivicArchiveLifecycleDraftMongoPersistence } from "../../modules/initiative-civic-archive-lifecycle/persistence/initiative-civic-archive-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativeCivicArchiveVersionMongoPersistence } from "../../modules/initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js";
import { hydrateMediaUploadRecordsFromMongo } from "../../modules/media-upload/media-upload.service.js";
import { hydrateInitiativeDecisionSessionDraftMongoPersistence } from "../../modules/initiative-decision-session-lifecycle/persistence/initiative-decision-session-draft-mongo.persistence.js";
import { hydrateInitiativeDecisionSessionRecommendationMongoPersistence } from "../../modules/initiative-decision-session-lifecycle/initiative-decision-session-recommendation.store.js";
import { hydrateInitiativeImplementationCommitmentMongoPersistence } from "../../modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js";
import { hydrateInitiativeImplementationCommitmentLifecycleDraftMongoPersistence } from "../../modules/initiative-implementation-commitment-lifecycle/persistence/initiative-implementation-commitment-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativeImplementationCommitmentPackageMongoPersistence } from "../../modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";
import { hydrateInitiativeImplementationTrackingMongoPersistence } from "../../modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js";
import { hydrateInitiativeImplementationTrackingLifecycleDraftMongoPersistence } from "../../modules/initiative-implementation-tracking-lifecycle/persistence/initiative-implementation-tracking-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativeImplementationTrackingPackageMongoPersistence } from "../../modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";
import { hydrateInitiativeImprovementProposalMongoPersistence } from "../../modules/initiative-improvement-proposal/persistence/initiative-improvement-proposal-mongo.persistence.js";
import { hydrateInitiativeOfficialResponseLifecycleDraftMongoPersistence } from "../../modules/initiative-official-response-lifecycle/persistence/initiative-official-response-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativeOfficialResponsePackageMongoPersistence } from "../../modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { hydrateInitiativePetitionDraftMongoPersistence } from "../../modules/initiative-petition-lifecycle/persistence/initiative-petition-draft-mongo.persistence.js";
import { hydrateInitiativeDiscussionCompletionMongoPersistence } from "../../modules/initiative-discussion-lifecycle/persistence/initiative-discussion-completion-mongo.persistence.js";
import { hydrateInitiativePublicImpactMongoPersistence } from "../../modules/initiative-public-impact/persistence/initiative-public-impact-mongo.persistence.js";
import { hydrateInitiativePublicImpactLifecycleDraftMongoPersistence } from "../../modules/initiative-public-impact-lifecycle/persistence/initiative-public-impact-lifecycle-draft-mongo.persistence.js";
import { hydrateInitiativePublicImpactReportMongoPersistence } from "../../modules/initiative-public-impact-lifecycle/initiative-public-impact-report.store.js";
import { hydrateInitiativeVersionRevisionMongoPersistence } from "../../modules/initiative-version-revision/persistence/initiative-version-revision-mongo.persistence.js";
import { hydrateInitiativeMongoPersistence, flushInitiativeMongoPersistence } from "../../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { ensureBrandLocalizationSeeded } from "../../modules/brand-localization/index.js";
import { ensureLegalLocalizationReady } from "../../modules/legal-localization/index.js";
import { ensureLanguageRegistrySeeded } from "../../modules/language/language-registry/index.js";
import { ensureTerminologyGlossarySeeded } from "../../modules/language/terminology-glossary/index.js";
import { hydrateOfficialResponseMongoPersistence } from "../../modules/official-response/persistence/official-response-mongo.persistence.js";
import { hydrateParticipationAreaMongoPersistence } from "../../modules/participation-area/persistence/participation-area-mongo.persistence.js";
import { hydratePublicCivicArchiveMongoPersistence } from "../../modules/public-civic-archive/persistence/public-civic-archive-mongo.persistence.js";
import { assertMongoConfigured } from "./mongo-config.js";
import { connectMongoClient } from "./mongo-connection.js";
import { ensureMongoIndexes } from "./mongo-indexes.js";

/** @deprecated Prefer shouldBootstrapMongoPersistence — kept for existing imports. */
export function isAnyMongoPersistenceSelected(): boolean {
  return shouldBootstrapMongoPersistence();
}

/**
 * Connects to MongoDB, ensures indexes, and hydrates module caches before HTTP routes load.
 * Production always bootstraps (durable keys default to mongodb).
 *
 * Initiative in-memory store sync runs after adapter hydrate so sample seeding
 * never writes to Mongo during module import.
 */
export async function bootstrapMongoPersistence(): Promise<void> {
  if (!shouldBootstrapMongoPersistence()) {
    return;
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();

  // Pack 02B — idempotent Language Registry seed (never overwrites Admin-modified rows).
  await ensureLanguageRegistrySeeded();
  // Pack 02F — idempotent Terminology Glossary seed (preserves Admin translations/status).
  await ensureTerminologyGlossarySeeded();
  // Pack 08I.2 — English published brand seed (never overwrites Admin-managed rows).
  await ensureBrandLocalizationSeeded();
  // Pack 08I.5 — Legal Localization readiness (no seed; counsel-approved copies only).
  await ensureLegalLocalizationReady();

  await Promise.all([
    hydrateInitiativeMongoPersistence(),
    hydrateInitiativeCollaborativeAnalysisMongoPersistence(),
    hydrateInitiativeImprovementProposalMongoPersistence(),
    hydrateInitiativeVersionRevisionMongoPersistence(),
    hydrateDecisionSessionMongoPersistence(),
    hydrateInitiativeCollectiveDecisionMongoPersistence(),
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
    hydrateCivicNominationMongoPersistence(),
    hydrateCivicNominationVoteMongoPersistence(),
    hydrateInitiativePetitionDraftMongoPersistence(),
    hydrateInitiativeDiscussionCompletionMongoPersistence(),
    hydrateInitiativeDecisionSessionDraftMongoPersistence(),
    hydrateInitiativeDecisionSessionRecommendationMongoPersistence(),
    hydrateInitiativeCollectiveDecisionLifecycleDraftMongoPersistence(),
    hydrateInitiativeImplementationCommitmentLifecycleDraftMongoPersistence(),
    hydrateInitiativeImplementationCommitmentPackageMongoPersistence(),
    hydrateInitiativeImplementationTrackingLifecycleDraftMongoPersistence(),
    hydrateInitiativeImplementationTrackingPackageMongoPersistence(),
    hydrateInitiativeOfficialResponseLifecycleDraftMongoPersistence(),
    hydrateInitiativeOfficialResponsePackageMongoPersistence(),
    hydrateInitiativePublicImpactLifecycleDraftMongoPersistence(),
    hydrateInitiativePublicImpactReportMongoPersistence(),
    hydrateInitiativeCivicArchiveLifecycleDraftMongoPersistence(),
    hydrateInitiativeCivicArchiveVersionMongoPersistence(),
    hydrateMediaUploadRecordsFromMongo(),
  ]);

  // Initiative store may seed a bootstrap sample; that write must run only after
  // Mongo connect + adapter hydrate (never during module import).
  const { syncInitiativeStoreAfterMongoHydrate } = await import(
    "../../modules/initiatives/initiative.store.js"
  );
  syncInitiativeStoreAfterMongoHydrate();
  const { syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate } = await import(
    "../../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
  );
  syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate();
  const { syncInitiativeCollectiveDecisionStoreAfterMongoHydrate } = await import(
    "../../modules/initiative-collective-decision/initiative-collective-decision.store.js"
  );
  syncInitiativeCollectiveDecisionStoreAfterMongoHydrate();
  await flushInitiativeMongoPersistence();
}
