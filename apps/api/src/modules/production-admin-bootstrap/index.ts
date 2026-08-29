export {
  ADMIN_SOURCE_MANIFEST_VERSION,
  APPROVED_PRODUCTION_ADMIN,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PROTECTED_PRODUCTION_STEWARD_IDS,
  isAllowedAdminBootstrapTargetDatabase,
  isProductionAdminBootstrapDatabase,
  isTestIsolationDatabase,
} from "./constants.js";

export { ProductionAdminBootstrapError } from "./errors.js";

export {
  assertAdminBootstrapTargetDatabase,
  assertAdminBootstrapWriteGuards,
  isExecuteModeRequested,
  resolveAdminBootstrapMode,
} from "./guards.js";

export {
  maskEmail,
  normalizeEmail,
  emailFingerprintSha256,
  assertNoSecretLeak,
} from "../production-steward-bootstrap/redact.js";

export {
  assertManifestMatchesAdminAllowList,
  loadSourceAdminManifestFromFile,
  parseSourceAdminManifest,
  writeSourceAdminManifestFile,
} from "./source-manifest.js";

export {
  prepareAdminDocuments,
  buildSanitizedAdminMember,
  buildSanitizedAdminMemberProfile,
} from "./build-documents.js";

export { assertNoAdminBootstrapCollisions } from "./collisions.js";

export {
  buildSafeAdminBootstrapLog,
  runProductionAdminBootstrap,
} from "./execute.js";
export type { RunProductionAdminBootstrapInput } from "./execute.js";

export type {
  AdminBootstrapMode,
  AdminBootstrapResult,
  AdminPreparedDocuments,
  SourceAdminIdentity,
  SourceAdminManifest,
} from "./types.js";
