/**
 * Pack 08I.16 / 08I.16.1 / Pack 1.3 — lightweight Mongo bootstrap for staging
 * translation operators.
 *
 * Full bootstrapMongoPersistence() hydrates the entire API surface into memory
 * (dozens of civic modules). The warm/repair operator only needs Initiative-path
 * discovery stores + Language Registry for target locales.
 *
 * Pack 08I.16.1 — hydrate alone is not enough: Initiative / Collaborative Analysis
 * use in-memory maps that must be re-bound via sync*AfterMongoHydrate() after the
 * Mongo snapshot adapters load (same order as full bootstrap). Without sync,
 * listInitiatives() stays empty and every dependent kind discovers zero records.
 *
 * Pack 08K.2 — Collective Decision uses the same Map+hydrate pattern. Without
 * hydrate+sync here, reconcile can enqueue CD warms while the warm consumer
 * loads null (`skipped_missing_source`) and leaves identities MISSING.
 *
 * Pack 1.3 — `--kinds` can narrow which snapshot maps are hydrated:
 *   initiative-scoped kinds → Initiative store
 *   collaborative_analysis → CA store (+ Initiative when scoped)
 *   collective_decision → CD store (+ Initiative when scoped)
 *   blog_post / civic_media / public_news / improvement_proposal alone → no Initiative/CA/CD hydrate
 *
 * Comments/petitions already use repository queries (no full-app hydrate), but
 * discovery still walks public initiatives first — so Initiative sync is required
 * for comment/petition public candidacy as well.
 * Improvement Proposal discovery pages Part D published collections directly
 * (no Initiative store walk / hydrate).
 *
 * Does not bypass eligibility/privacy — loaders still enforce published/public.
 */

import { shouldBootstrapMongoPersistence } from "../../config/production-persistence-contract.js";
import { hydrateInitiativeCollaborativeAnalysisMongoPersistence } from "../../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js";
import { hydrateInitiativeCollectiveDecisionMongoPersistence } from "../../modules/initiative-collective-decision/persistence/initiative-collective-decision-mongo.persistence.js";
import { hydrateInitiativeMongoPersistence } from "../../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { ensureLanguageRegistrySeeded } from "../../modules/language/language-registry/language-registry.repository.js";
import {
  resolveContentTranslationOperatorHydrateScopes,
  type ContentTranslationOperatorHydrateScopes,
  type StagingWarmSourceKind,
} from "../../modules/language/content-translation-staging-warm-operator-scope.js";
import { assertMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";

export type ContentTranslationOperatorBootstrapMode =
  | "lightweight_discovery"
  | "full_application"
  | "skipped";

export type ContentTranslationOperatorBootstrapResult = {
  readonly mode: ContentTranslationOperatorBootstrapMode;
  readonly hydrateScopes: ContentTranslationOperatorHydrateScopes;
};

/**
 * Hydrate only stores required for the requested recovery kinds, then sync
 * in-memory maps from the Mongo adapter caches.
 *
 * Omit `kinds` (or pass undefined) for legacy full Initiative+CA+CD hydrate.
 */
export async function bootstrapContentTranslationOperatorPersistence(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly hydrateScopes?: ContentTranslationOperatorHydrateScopes;
}): Promise<ContentTranslationOperatorBootstrapResult> {
  const hydrateScopes =
    input?.hydrateScopes ??
    resolveContentTranslationOperatorHydrateScopes(input?.kinds);

  if (!shouldBootstrapMongoPersistence()) {
    return { mode: "skipped", hydrateScopes };
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();
  await ensureLanguageRegistrySeeded();

  const hydrateTasks: Promise<unknown>[] = [];
  if (hydrateScopes.initiative) {
    hydrateTasks.push(hydrateInitiativeMongoPersistence());
  }
  if (hydrateScopes.collaborativeAnalysis) {
    hydrateTasks.push(hydrateInitiativeCollaborativeAnalysisMongoPersistence());
  }
  if (hydrateScopes.collectiveDecision) {
    hydrateTasks.push(hydrateInitiativeCollectiveDecisionMongoPersistence());
  }
  if (hydrateTasks.length > 0) {
    await Promise.all(hydrateTasks);
  }

  if (hydrateScopes.initiative) {
    const { syncInitiativeStoreAfterMongoHydrate } = await import(
      "../../modules/initiatives/initiative.store.js"
    );
    syncInitiativeStoreAfterMongoHydrate();
  }

  if (hydrateScopes.collaborativeAnalysis) {
    const { syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate } = await import(
      "../../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
    );
    syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate();
  }

  if (hydrateScopes.collectiveDecision) {
    const { syncInitiativeCollectiveDecisionStoreAfterMongoHydrate } = await import(
      "../../modules/initiative-collective-decision/initiative-collective-decision.store.js"
    );
    syncInitiativeCollectiveDecisionStoreAfterMongoHydrate();
  }

  return { mode: "lightweight_discovery", hydrateScopes };
}
