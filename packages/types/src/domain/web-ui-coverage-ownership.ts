/**
 * Canonical WEB_UI coverage ownership contract (Step 15D.7).
 *
 * Answers for every English catalog path:
 *   Public required? Participant required? Privileged? Explicit other? Unknown?
 *
 * Runtime readiness still uses isPublicReaderWebUiRequiredPath /
 * isParticipantWebUiRequiredPath. This module is the reviewable ownership
 * layer those predicates are validated against, and the unknown-path guard
 * for bundled reference languages (uk / ar / zh-Hant).
 *
 * Locale-independent. No per-language branches.
 */

import {
  isParticipantWebUiRequiredPath,
  isParticipantWorkspaceExcludedPath,
} from "./participant-web-ui-scope.js";
import { isPublicReaderWebUiRequiredPath } from "./public-reader-web-ui-scope.js";

export const WEB_UI_COVERAGE_OWNERSHIP_KINDS = [
  "public_required",
  "participant_required",
  "ordinary_shared",
  "privileged",
  "other_owner",
  "legacy",
  "unknown",
] as const;

export type WebUiCoverageOwnershipKind =
  (typeof WEB_UI_COVERAGE_OWNERSHIP_KINDS)[number];

export type WebUiCoverageClassification = {
  readonly pathKey: string;
  readonly kind: WebUiCoverageOwnershipKind;
  readonly publicRequired: boolean;
  readonly participantRequired: boolean;
  readonly privileged: boolean;
  readonly explicitlyExcluded: boolean;
  readonly unknown: boolean;
};

/**
 * Prefixes intentionally outside ordinary Public ∪ Participant readiness.
 * Privileged editor / steward / admin tooling (still valid catalog keys).
 */
export const WEB_UI_PRIVILEGED_PREFIXES = [
  "workspace.editorialPage.",
  "workspace.editorPanel",
  "workspace.administration",
  "workspace.adminPanel",
  "workspace.editorialReview",
  // Author lifecycle working trees not listed in PUBLIC_READER prefixes.
  // Public-required author subtrees still win via isPublicReaderWebUiRequiredPath.
  "initiativeExperience.author.",
] as const;

/**
 * Explicit non-WEB_UI-readiness owners (Search/SEO metadata chrome, etc.).
 * Not unknown — deliberately outside Public/Participant denominators.
 */
export const WEB_UI_OTHER_OWNER_PREFIXES = [
  "seo.",
] as const;

/**
 * Explicit legacy / obsolete catalog paths (none reserved yet — empty list
 * keeps the unknown guard strict).
 */
export const WEB_UI_LEGACY_PREFIXES = [] as const;

function matchesPrefix(pathKey: string, prefix: string): boolean {
  if (prefix.endsWith(".")) {
    return pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix);
  }
  return pathKey === prefix || pathKey.startsWith(`${prefix}.`);
}

export function isWebUiPrivilegedPath(pathKey: string): boolean {
  if (isParticipantWorkspaceExcludedPath(pathKey)) {
    return true;
  }
  // Author trees that are Public-required (*.public, field labels, etc.) are
  // not privileged for coverage purposes.
  if (isPublicReaderWebUiRequiredPath(pathKey)) {
    return false;
  }
  return WEB_UI_PRIVILEGED_PREFIXES.some((prefix) => matchesPrefix(pathKey, prefix));
}

export function isWebUiOtherOwnerPath(pathKey: string): boolean {
  return WEB_UI_OTHER_OWNER_PREFIXES.some((prefix) => matchesPrefix(pathKey, prefix));
}

export function isWebUiLegacyPath(pathKey: string): boolean {
  return WEB_UI_LEGACY_PREFIXES.some((prefix) => matchesPrefix(pathKey, prefix));
}

/**
 * Classify one canonical English WEB_UI path against the ownership contract.
 */
export function classifyWebUiCoveragePath(pathKey: string): WebUiCoverageClassification {
  const publicRequired = isPublicReaderWebUiRequiredPath(pathKey);
  const participantRequired = isParticipantWebUiRequiredPath(pathKey);
  const privileged = isWebUiPrivilegedPath(pathKey);
  const otherOwner = isWebUiOtherOwnerPath(pathKey);
  const legacy = isWebUiLegacyPath(pathKey);
  const explicitlyExcluded = privileged || otherOwner || legacy;

  let kind: WebUiCoverageOwnershipKind;
  if (publicRequired && participantRequired) {
    kind = "ordinary_shared";
  } else if (publicRequired) {
    kind = "public_required";
  } else if (participantRequired) {
    kind = "participant_required";
  } else if (privileged) {
    kind = "privileged";
  } else if (otherOwner) {
    kind = "other_owner";
  } else if (legacy) {
    kind = "legacy";
  } else {
    kind = "unknown";
  }

  return {
    pathKey,
    kind,
    publicRequired,
    participantRequired,
    privileged,
    explicitlyExcluded,
    unknown: kind === "unknown",
  };
}

/** True when a path is ordinary Public ∪ Participant readiness-blocking. */
export function isOrdinaryCoverageRequiredPath(pathKey: string): boolean {
  return (
    isPublicReaderWebUiRequiredPath(pathKey) || isParticipantWebUiRequiredPath(pathKey)
  );
}

/**
 * Paths that must not remain unclassified when present in all bundled
 * reference packs (en ∩ uk ∩ ar ∩ zh-Hant).
 */
export function listUnknownWebUiCoveragePaths(
  pathKeys: readonly string[],
): readonly string[] {
  return pathKeys
    .filter((pathKey) => classifyWebUiCoveragePath(pathKey).unknown)
    .sort();
}
