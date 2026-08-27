/**
 * Admin Foundation Pack 02 — Canonical Capability Resolver & Immutable Audit.
 *
 * Services only — no Admin Console routes in this pack.
 */

export {
  AdministrationAuditImmutableError,
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "./administration.errors.js";
export {
  listAdminParticipants,
  resolveAdminParticipantPublicProfile,
  AdminParticipantDirectoryValidationError,
  AdminParticipantNotFoundError,
  AdminParticipantPublicProfileUnavailableError,
} from "./admin-participant-directory.service.js";
export { default as adminParticipantDirectoryRouter } from "./admin-participant-directory.routes.js";
export {
  getAdminInitiativeDetail,
  listAdminInitiatives,
  AdminInitiativeDirectoryValidationError,
} from "./admin-initiative-directory.service.js";
export {
  hideAdminInitiativeFromPublic,
  restoreAdminInitiativePublicVisibility,
  AdminInitiativeCommandValidationError,
} from "./admin-initiative-visibility.service.js";
export {
  blockAdminInitiative,
  unblockAdminInitiative,
  AdminInitiativeModerationValidationError,
} from "./admin-initiative-moderation.service.js";
export {
  listAdminPublicChoiceElections,
  getAdminPublicChoiceDetail,
  blockAdminPublicChoiceCandidate,
  unblockAdminPublicChoiceCandidate,
  updateAdminPublicChoiceCandidate,
  AdminPublicChoiceValidationError,
} from "./admin-public-choice.service.js";
export { default as adminInitiativeDirectoryRouter } from "./admin-initiative-directory.routes.js";
export { default as adminPublicChoiceRouter } from "./admin-public-choice.routes.js";
export {
  listAdminAuditBrowser,
  AdminAuditBrowserValidationError,
} from "./admin-audit.service.js";
export { default as adminAuditRouter } from "./admin-audit.routes.js";
export {
  AuditService,
  deleteAdministrationAudit,
  getAdministrationAuditById,
  listAdministrationAuditsForTarget,
  record,
  recordAdministrationAuditBestEffort,
  updateAdministrationAudit,
} from "./audit.service.js";
export {
  expandBlogCapabilitiesToPlatformIds,
  mapBlogCapabilityToPlatformIds,
} from "./blog-capability-bridge.js";
export {
  runWithCapabilityResolutionContext,
} from "./capability-resolution-context.js";
export {
  assertAnyCapability,
  assertCapability,
  hasAllCapabilities,
  hasAnyCapability,
  hasCapability,
  resolveParticipantCapabilities,
  type ResolveCapabilitiesInput,
} from "./capability-resolver.js";
export {
  assertOwnership,
  isOwner,
  ownershipOf,
} from "./ownership.js";
export {
  grantPlatformCapability,
  revokePlatformCapability,
} from "./platform-capability-grant.service.js";
export {
  deleteAdministrationAuditByActorIdsForTests,
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "./persistence/administration-audit.repository.js";
export {
  deletePlatformCapabilityGrantsByParticipantIdsForTests,
  listActivePlatformCapabilityGrants,
  resetPlatformCapabilityGrantsMemoryForTests,
} from "./persistence/platform-capability-grant.repository.js";
