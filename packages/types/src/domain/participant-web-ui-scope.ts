/**
 * Canonical participant WEB_UI readiness scope (Step 15D.2).
 *
 * Ordinary authenticated Participant surfaces — Workspace home/shell,
 * Notifications page chrome + typed presentation, and shared event labels
 * used on Workspace. Distinct from PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.
 *
 * Locale-independent. Ownership of catalog keys is unchanged; this list only
 * decides which keys are required before a locale is Participant-presentation
 * data-ready.
 *
 * `workspace.*` mixes ordinary Participant chrome with professional tooling.
 * Participant readiness includes `workspace.*` except the excluded author /
 * steward / admin trees below.
 */

/** Professional Workspace trees — valid catalog keys, not Participant-blocking. */
export const PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES = [
  "workspace.publishingPage.",
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
  "civicActivity.timeline.events.",
] as const;

export type ParticipantWebUiRequiredPrefix =
  (typeof PARTICIPANT_WEB_UI_REQUIRED_PREFIXES)[number];

export type ParticipantWorkspaceExcludedPrefix =
  (typeof PARTICIPANT_WORKSPACE_EXCLUDED_PREFIXES)[number];

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

/**
 * True when a catalog path is required for ordinary Participant WEB_UI readiness.
 * Includes ordinary Workspace chrome (excluding professional trees), Notifications,
 * and Workspace activity event labels.
 */
export function isParticipantWebUiRequiredPath(pathKey: string): boolean {
  if (pathKey === "workspace" || pathKey.startsWith("workspace.")) {
    return !isParticipantWorkspaceExcludedPath(pathKey);
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
