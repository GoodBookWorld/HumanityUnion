export { default as authRouter } from "./auth.routes.js";
export { authenticationMiddleware, requireAuthenticationMiddleware } from "./auth.middleware.js";
export {
  authenticatedWorkspaceWriteMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
} from "./auth-workspace-gate.js";
export { createAuthRateLimiter, clearAuthRateLimitBucketsForTests } from "./auth-rate-limit.js";
export { bootstrapAuthIdentity, getCurrentAuthIdentity } from "./auth.identity.js";
export { bootstrapSessionContext } from "./session.context.js";
export type { SessionContext } from "./session.context.js";
export { AuthenticationRequiredError, AuthPersistenceUnavailableError } from "./auth.errors.js";
export {
  registerAuthUser,
  loginAuthUser,
  refreshAuthSession,
  logoutAuthSession,
  getAuthUserPublicById,
} from "./auth.service.js";
export { toAuthUserPublic } from "./auth-user.projection.js";
