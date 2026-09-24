/**
 * Canonical participant WEB_UI readiness scope (Step 15D.2 / 15D.5 / 15D.7).
 *
 * Ordinary authenticated Participant surfaces — Workspace, Notifications,
 * Civic Activity, Initiative creation/manage, own Profile, Preferences,
 * own-account security/password/email chrome, authoring application/status,
 * and Publishing chrome.
 * Distinct from PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.
 *
 * Locale-independent. Ownership of catalog keys is unchanged; this list only
 * decides which keys are required before a locale is Participant-presentation
 * data-ready.
 *
 * `workspace.*` mixes ordinary Participant chrome with professional tooling.
 * Participant readiness includes `workspace.*` except the excluded steward /
 * editor / admin trees below. Publishing is a Participant capability after
 * author grant — not steward infrastructure — so it is included.
 */

/** Professional Workspace trees — valid catalog keys, not Participant-blocking. */
export const PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES = [
  "workspace.editorialPage.",
  "workspace.editorPanel",
  "workspace.administration",
  "workspace.adminPanel",
  "workspace.editorialReview",
] as const;

/**
 * Exact / prefix paths required for ordinary Participant WEB_UI readiness.
 * Workspace uses an include-all-except classifier (see isParticipantWebUiRequiredPath).
 */
export const PARTICIPANT_WEB_UI_REQUIRED_PREFIXES = [
  "notifications.",
  "civicActivity.",
  "initiativeExperience.manage.",
  "memberProfile.",
  "preferences.",
  "authoringPage.",
] as const;

/**
 * Exact auth paths for ordinary signed-in own-account chrome:
 * AccountSecuritySection + AccountPanel password/email/login controls.
 * Deliberately not all `auth.*` — public login/signup/recovery stay on the
 * Public-reader classifier (`auth.` prefix there).
 */
export const PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS = [
  // AccountSecuritySection (2FA / account security)
  "auth.accountSecurity",
  "auth.emailConfirmed",
  "auth.yes",
  "auth.no",
  "auth.twoStepLoginByEmail",
  "auth.enabled",
  "auth.disabled",
  "auth.twoStepLoginHelp",
  "auth.confirmEmailBeforeTwoStep",
  "auth.verificationCode",
  "auth.securityActionFailed",
  "auth.verificationCodeSent",
  "auth.confirmEnable",
  "auth.confirmDisable",
  "auth.resendCode",
  "auth.currentPassword",
  "auth.enableTwoStepLogin",
  "auth.disableTwoStepLogin",
  "auth.twoStepCodeSent",
  "auth.twoStepEnabledSuccess",
  "auth.twoStepDisabledSuccess",
  "auth.newVerificationCodeSent",
  "auth.incorrectCode",
  // AccountPanel own-account management
  "auth.newPassword",
  "auth.forgotPassword",
  "auth.email",
  "auth.logIn",
  "auth.confirmEmail",
] as const;

/** @deprecated Use PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS (Step 15D.7). */
export const PARTICIPANT_AUTH_ACCOUNT_SECURITY_PATHS = PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS;

export type ParticipantWebUiRequiredPrefix =
  (typeof PARTICIPANT_WEB_UI_REQUIRED_PREFIXES)[number];

export type ParticipantWorkspaceExcludedPrefix =
  (typeof PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES)[number];

export type ParticipantAuthOwnAccountPath =
  (typeof PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS)[number];

/** @deprecated Use ParticipantAuthOwnAccountPath. */
export type ParticipantAuthAccountSecurityPath = ParticipantAuthOwnAccountPath;

function matchesPrefix(pathKey: string, prefix: string): boolean {
  if (prefix.endsWith(".")) {
    return pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix);
  }
  return pathKey === prefix || pathKey.startsWith(`${prefix}.`);
}

/** True when a workspace.* path is professional tooling (not Participant-required). */
export function isParticipantWorkspaceExcludedPath(pathKey: string): boolean {
  if (!pathKey.startsWith("workspace.") && pathKey !== "workspace") {
    return false;
  }
  return PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES.some((prefix) =>
    matchesPrefix(pathKey, prefix),
  );
}

/** True when a path is ordinary signed-in own-account auth chrome. */
export function isParticipantAuthOwnAccountPath(pathKey: string): boolean {
  return (PARTICIPANT_AUTH_OWN_ACCOUNT_PATHS as readonly string[]).includes(pathKey);
}

/** @deprecated Use isParticipantAuthOwnAccountPath. */
export function isParticipantAuthAccountSecurityPath(pathKey: string): boolean {
  return isParticipantAuthOwnAccountPath(pathKey);
}

/**
 * True when a catalog path is required for ordinary Participant WEB_UI readiness.
 * Includes ordinary Workspace chrome (excluding professional trees), Notifications,
 * full Civic Activity chrome, Initiative manage, member profile, Preferences,
 * authoring application/status, and the own-account auth subset.
 */
export function isParticipantWebUiRequiredPath(pathKey: string): boolean {
  if (pathKey === "workspace" || pathKey.startsWith("workspace.")) {
    return !isParticipantWorkspaceExcludedPath(pathKey);
  }
  if (isParticipantAuthOwnAccountPath(pathKey)) {
    return true;
  }
  return PARTICIPANT_WEB_UI_REQUIRED_PREFIXES.some((prefix) =>
    matchesPrefix(pathKey, prefix),
  );
}

/**
 * Ordinary activation / pack-preparation corpus: public-reader ∪ participant.
 * Does not include author/steward/admin-only Workspace trees.
 */
export function isOrdinaryWebUiRequiredPath(
  pathKey: string,
  isPublicReader: (path: string) => boolean,
): boolean {
  return isPublicReader(pathKey) || isParticipantWebUiRequiredPath(pathKey);
}
