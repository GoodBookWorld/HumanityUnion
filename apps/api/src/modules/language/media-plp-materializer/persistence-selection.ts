/**
 * Reset 03B.1 — durable PLP persistence selection + observability for materializer.
 */

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  assertPublishedLocalizationMongoPersistenceActive,
  getPublishedLocalizationPersistenceMode,
  requirePublishedLocalizationMongoPersistence,
} from "../published-localized-presentation/persistence/repository.js";

export type MediaPlpPersistenceObservability = {
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY" | "UNSET";
  readonly PLP_CURRENT_COLLECTION: string;
  readonly PLP_HISTORY_COLLECTION: string;
  readonly PLP_READ_DATABASE: string | null;
  readonly PLP_WRITE_DATABASE: string | null;
};

/**
 * Fail-closed: `--mongo` materializer must use durable Mongo PLP persistence.
 * Never silently select the in-process memory Map.
 */
export function requireMediaPlpMaterializerMongoPersistence(
  reason: string = "materialize:media-plp --mongo",
): MediaPlpPersistenceObservability {
  if (!isMongoConfigured()) {
    throw new Error(
      `${reason} requires MONGODB_URI; refusing memory PLP fallback.`,
    );
  }
  requirePublishedLocalizationMongoPersistence(reason);
  assertPublishedLocalizationMongoPersistenceActive(reason);
  return getMediaPlpPersistenceObservability();
}

export function getMediaPlpPersistenceObservability(): MediaPlpPersistenceObservability {
  const mode = getPublishedLocalizationPersistenceMode();
  const database = isMongoConfigured() ? resolveMongoConfig().database : null;
  return {
    PLP_PERSISTENCE_MODE: mode === "mongo" ? "MONGO" : mode === "memory" ? "MEMORY" : "UNSET",
    PLP_CURRENT_COLLECTION: MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
    PLP_HISTORY_COLLECTION: MONGO_COLLECTIONS.publishedLocalizedPresentationsHistory,
    PLP_READ_DATABASE: database,
    PLP_WRITE_DATABASE: database,
  };
}
