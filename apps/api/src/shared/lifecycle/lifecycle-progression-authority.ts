/**
 * Initiative Lifecycle — Authority Freeze.
 *
 * Canonical progression authority is ONLY:
 *   Lifecycle Stage Registry
 *   + LifecycleProfile route
 *   + Author completion / published stage artifacts
 *   → resolveInitiativeLifecycleState
 *   → buildLifecycleNavigation (experience.currentStageId)
 *
 * Competing systems listed below are COMPATIBILITY_DISPLAY_ONLY and must
 * never advance, block, or recalculate canonical Lifecycle progression.
 */

import {
  INITIATIVE_LIFECYCLE_FIELD_AUTHORITY,
  resolveInitiativeLifecycleState,
  type InitiativeLifecycleProfile,
} from "@hu/types";

/** Subsystems that must not feed experience.currentStageId. */
export const LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES = [
  "capability02.buildPipelineStatus",
  "legacy.collaborativeAnalysis.progressPolicyThresholds",
  "legacy.collectiveDecision.quorumNextLifecycleStage",
  "legacy.collectiveDecision.sessionBoundEligibility",
  "legacy.implementationCommitment.readinessThresholds",
  "legacy.implementationCommitment.perRecordEligibility",
  "legacy.implementationTracking.perRecordEligibility",
  "legacy.publicImpact.perRecordEligibility",
  "task037.publicCivicArchive.progressionCounts",
  "initiative.status",
  "frontend.hashSelectedStageId",
] as const;

export function describeCanonicalLifecycleProgressionAuthority(): string {
  return [
    "INITIATIVE_LIFECYCLE_STAGE_REGISTRY",
    "lifecycleProfile route",
    "published Author completion/stage artifacts",
    "resolveInitiativeLifecycleState",
  ].join(" + ");
}

/**
 * Pure derivation used by public experience — identical for every viewer.
 * Intentionally accepts only published stage counts + profile (never Cap02,
 * engagement tallies, Initiative.status, or hash).
 */
export function resolveCanonicalCurrentStageId(input: {
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  readonly publishedStageCounts: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
}): string {
  return resolveInitiativeLifecycleState({
    lifecycleProfile: input.lifecycleProfile,
    publishedStageCounts: input.publishedStageCounts,
  }).currentStageId;
}

export function assertFieldIsNotCanonicalProgressAuthority(
  field: keyof typeof INITIATIVE_LIFECYCLE_FIELD_AUTHORITY,
): void {
  const classification = INITIATIVE_LIFECYCLE_FIELD_AUTHORITY[field];
  if (
    classification === "CANONICAL" ||
    classification === "CANONICAL_CONFIGURATION" ||
    classification === "DERIVED"
  ) {
    throw new Error(`${field} is part of canonical Lifecycle progression authority.`);
  }
}
