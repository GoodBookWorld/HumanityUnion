/**
 * Pack 08I.16 — lightweight Mongo bootstrap for staging translation operators.
 *
 * Full bootstrapMongoPersistence() hydrates the entire API surface into memory
 * (dozens of civic modules). The warm/repair operator only needs Initiative-path
 * discovery stores + Language Registry for target locales.
 *
 * Comments/petitions already use repository queries (no full-app hydrate).
 * Does not bypass eligibility/privacy — loaders still enforce published/public.
 */

import { shouldBootstrapMongoPersistence } from "../../config/production-persistence-contract.js";
import { hydrateInitiativeCollaborativeAnalysisMongoPersistence } from "../../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js";
import {
  hydrateInitiativeMongoPersistence,
} from "../../modules/initiatives/persistence/initiative-mongo.persistence.js";
import { ensureLanguageRegistrySeeded } from "../../modules/language/language-registry/index.js";
import { assertMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";

export type ContentTranslationOperatorBootstrapMode =
  | "lightweight_discovery"
  | "full_application"
  | "skipped";

/**
 * Hydrate only stores required for Initiative-path warm discovery.
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

  return { mode: "lightweight_discovery" };
}
