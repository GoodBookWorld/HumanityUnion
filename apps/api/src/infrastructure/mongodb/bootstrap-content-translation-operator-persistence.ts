/**
 * Pack 08I.16 / 08I.16.1 — lightweight Mongo bootstrap for staging translation operators.
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
 * Comments/petitions already use repository queries (no full-app hydrate), but
 * discovery still walks public initiatives first — so Initiative sync is required
 * for comment/petition public candidacy as well.
 *
 * Does not bypass eligibility/privacy — loaders still enforce published/public.
 */

import { shouldBootstrapMongoPersistence } from "../../config/production-persistence-contract.js";
import { hydrateInitiativeCollaborativeAnalysisMongoPersistence } from "../../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js";
import { hydrateInitiativeMongoPersistence } from "../../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { ensureLanguageRegistrySeeded } from "../../modules/language/language-registry/index.js";
import { assertMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";

export type ContentTranslationOperatorBootstrapMode =
  | "lightweight_discovery"
  | "full_application"
  | "skipped";

/**
 * Hydrate only stores required for Initiative-path warm discovery, then sync
 * in-memory maps from the Mongo adapter caches.
 */
export async function bootstrapContentTranslationOperatorPersistence(): Promise<{
  readonly mode: ContentTranslationOperatorBootstrapMode;
}> {
  if (!shouldBootstrapMongoPersistence()) {
    return { mode: "skipped" };
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();
  await ensureLanguageRegistrySeeded();

  await Promise.all([
    hydrateInitiativeMongoPersistence(),
    hydrateInitiativeCollaborativeAnalysisMongoPersistence(),
  ]);

  // Pack 08I.16.1 — mirror full bootstrap: adapter hydrate then store re-bind.
  const { syncInitiativeStoreAfterMongoHydrate } = await import(
    "../../modules/initiatives/initiative.store.js"
  );
  syncInitiativeStoreAfterMongoHydrate();

  const { syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate } = await import(
    "../../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
  );
  syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate();

  return { mode: "lightweight_discovery" };
}
