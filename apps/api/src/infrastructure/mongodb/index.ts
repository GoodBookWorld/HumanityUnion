export {
  bootstrapMongoPersistence,
  isAnyMongoPersistenceSelected,
} from "./bootstrap-mongo-persistence.js";
export { createMongoSnapshotPersistence } from "./create-mongo-snapshot-persistence.js";
export type { MongoSnapshotPersistenceHandles } from "./create-mongo-snapshot-persistence.js";
export { assertMongoConfigured, isMongoConfigured, resolveMongoConfig } from "./mongo-config.js";
export type { MongoConfig } from "./mongo-config.js";
export { MONGO_COLLECTIONS } from "./mongo-collections.js";
export type { MongoCollectionName } from "./mongo-collections.js";
export { connectMongoClient, disconnectMongoClient, getMongoClient } from "./mongo-connection.js";
export { getMongoCollection, getMongoDatabase } from "./mongo-database.js";
export { checkMongoConnection } from "./mongo-health.js";
export type { MongoHealthCheckResult } from "./mongo-health.js";
export { ensureMongoIndexes } from "./mongo-indexes.js";
export {
  ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR,
  COLLECTION_PRESSURE_THRESHOLDS,
  DEFAULT_CLUSTER_COLLECTION_LIMIT,
  KEEP_TEST_DATABASE_ENV_VAR,
  KEEP_VERIFICATION_DATABASE_ENV_VAR,
  PROTECTED_DATABASE_NAMES,
  assertMayCreateEphemeralDatabase,
  assertSafeOwnedEphemeralDatabaseName,
  classifyCollectionPressure,
  dropOwnedEphemeralDatabase,
  isProtectedDatabaseName,
} from "./ephemeral-mongo-database-safety.js";
export type {
  CollectionPressureAssessment,
  CollectionPressureLevel,
  EphemeralDatabaseKind,
} from "./ephemeral-mongo-database-safety.js";
export {
  countCollectionDocuments,
  deleteRecordsByIdPrefix,
  ensureCollectionIndexes,
  entityIdToMongoId,
  findOneById,
  loadRecordMap,
  mongoIdToEntityId,
  replaceRecordMap,
  loadSingletonDocument,
  replaceSingletonDocument,
  MONGO_SINGLETON_DOCUMENT_ID,
} from "./mongo-snapshot-store.js";
