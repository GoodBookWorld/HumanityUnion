export {
  APPROVED_PRODUCTION_STEWARDS,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
  PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV,
  SOURCE_MANIFEST_VERSION,
  isAllowedBootstrapTargetDatabase,
  isProductionStewardBootstrapDatabase,
  isTestIsolationDatabase,
} from "./constants.js";

export { ProductionStewardBootstrapError } from "./errors.js";

export {
  assertBootstrapTargetDatabase,
  assertBootstrapWriteGuards,
  isExecuteModeRequested,
  resolveBootstrapMode,
} from "./guards.js";

export { maskEmail, normalizeEmail, emailFingerprintSha256, assertNoSecretLeak } from "./redact.js";

export {
  assertManifestMatchesAllowList,
  loadSourceStewardManifestFromFile,
  parseSourceStewardManifest,
  writeSourceStewardManifestFile,
} from "./source-manifest.js";

export { prepareStewardDocuments, buildSanitizedMember, buildSanitizedMemberProfile } from "./build-documents.js";

export { assertNoBootstrapCollisions } from "./collisions.js";

export {
  buildSafeBootstrapLog,
  runProductionStewardBootstrap,
} from "./execute.js";
export type { RunProductionStewardBootstrapInput } from "./execute.js";

export type {
  BootstrapMode,
  SourceStewardIdentity,
  SourceStewardManifest,
  StewardBootstrapResult,
  StewardPreparedDocuments,
} from "./types.js";
