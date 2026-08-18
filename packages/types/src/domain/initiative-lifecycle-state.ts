/**
 * Initiative Lifecycle Finalization Phase 02 — derived lifecycle state resolver.
 *
 * Canonical progress is DERIVED from published lifecycle artifact counts + profile.
 * Never from Initiative.status. Frontend hash selection is DISPLAY-ONLY.
 */

import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import {
  getLifecycleStageRouteForProfile,
  listNotApplicableLifecycleStageIds,
  resolveInitiativeLifecycleProfile,
  type InitiativeLifecycleProfile,
} from "./initiative-lifecycle-profile.js";

/**
 * Applicability / availability vocabulary (Phase 02).
 * Distinct from visual progress strings in public experience navigation.
 */
export type InitiativeLifecycleStageApplicability =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "AVAILABLE"
  | "CURRENT"
  | "COMPLETED"
  | "LOCKED";

export interface InitiativeLifecycleStateSnapshot {
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: InitiativeLifecycleStageId;
  readonly nextStageId: InitiativeLifecycleStageId | null;
  readonly completedStageIds: readonly InitiativeLifecycleStageId[];
  readonly availableStageIds: readonly InitiativeLifecycleStageId[];
  readonly lockedStageIds: readonly InitiativeLifecycleStageId[];
  readonly notApplicableStageIds: readonly InitiativeLifecycleStageId[];
  readonly stageApplicability: Readonly<Record<string, InitiativeLifecycleStageApplicability>>;
}

export interface ResolveInitiativeLifecycleStateInput {
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  /**
   * Counts of published public artifacts per registry stageId.
   * Stages with count > 0 are treated as completed/published for progress.
   */
  readonly publishedStageCounts: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
}

function readCount(
  counts: ResolveInitiativeLifecycleStateInput["publishedStageCounts"],
  stageId: string,
): number {
  if (counts instanceof Map) {
    return counts.get(stageId) ?? 0;
  }

  return (counts as Readonly<Record<string, number>>)[stageId] ?? 0;
}

/**
 * Derives deterministic lifecycle progress for the Initiative's profile route.
 *
 * Rules:
 * - NOT_APPLICABLE stages are skipped (not missing/blocked).
 * - current = first applicable stage after furthest published applicable stage
 *   (or the last stage if all published).
 * - AVAILABLE = current + any already-published applicable stages (revisit).
 * - LOCKED = applicable stages after current that are not yet published.
 * - COMPLETED = applicable stages with published artifacts (and earlier than/at furthest).
 */
export function resolveInitiativeLifecycleState(
  input: ResolveInitiativeLifecycleStateInput,
): InitiativeLifecycleStateSnapshot {
  const lifecycleProfile = resolveInitiativeLifecycleProfile(input.lifecycleProfile);
  const route = getLifecycleStageRouteForProfile(lifecycleProfile);
  const notApplicableStageIds = listNotApplicableLifecycleStageIds(lifecycleProfile);

  let furthestPublishedIndex = -1;

  for (let index = 0; index < route.length; index += 1) {
    const stageId = route[index]!;
    if (readCount(input.publishedStageCounts, stageId) > 0) {
      furthestPublishedIndex = index;
    }
  }

  const currentIndex =
    furthestPublishedIndex < 0
      ? 0
      : furthestPublishedIndex >= route.length - 1
        ? furthestPublishedIndex
        : furthestPublishedIndex + 1;

  const currentStageId = route[currentIndex]!;
  const nextStageId =
    currentIndex < route.length - 1 ? (route[currentIndex + 1] ?? null) : null;

  const completedStageIds: InitiativeLifecycleStageId[] = [];
  const availableStageIds: InitiativeLifecycleStageId[] = [];
  const lockedStageIds: InitiativeLifecycleStageId[] = [];
  const stageApplicability: Record<string, InitiativeLifecycleStageApplicability> = {};

  for (const stageId of notApplicableStageIds) {
    stageApplicability[stageId] = "NOT_APPLICABLE";
  }

  for (let index = 0; index < route.length; index += 1) {
    const stageId = route[index]!;
    const published = readCount(input.publishedStageCounts, stageId) > 0;

    if (index === currentIndex) {
      availableStageIds.push(stageId);
      stageApplicability[stageId] = "CURRENT";
      if (published) {
        completedStageIds.push(stageId);
      }
      continue;
    }

    if (published || index < currentIndex) {
      if (published) {
        completedStageIds.push(stageId);
      }
      availableStageIds.push(stageId);
      stageApplicability[stageId] = published ? "COMPLETED" : "AVAILABLE";
      continue;
    }

    lockedStageIds.push(stageId);
    stageApplicability[stageId] = "LOCKED";
  }

  return {
    lifecycleProfile,
    currentStageId,
    nextStageId,
    completedStageIds,
    availableStageIds,
    lockedStageIds,
    notApplicableStageIds,
    stageApplicability,
  };
}

/**
 * Field / subsystem authority for Initiative Lifecycle progression.
 *
 * Canonical progression is ONLY:
 *   Stage Registry + LifecycleProfile route + Author completion/published
 *   artifacts → resolveInitiativeLifecycleState
 *
 * Anything marked COMPATIBILITY_DISPLAY_ONLY or LEGACY must not advance,
 * block, or recalculate `experience.currentStageId`.
 */
export const INITIATIVE_LIFECYCLE_FIELD_AUTHORITY = {
  /** Initiative configuration selecting the Stage Registry route — not progress. */
  lifecycleProfile: "CANONICAL_CONFIGURATION",
  /** Stage Registry order / applicability metadata. */
  lifecycleStageRegistry: "CANONICAL_CONFIGURATION",
  /** Author completion markers + published stage artifacts (counts). */
  publishedLifecycleArtifacts: "CANONICAL",
  /** Output of resolveInitiativeLifecycleState / buildLifecycleNavigation. */
  derivedLifecycleState: "DERIVED",
  /** Initiative record draft→published→projected→archived only. */
  initiativeLifecyclePhase: "CANONICAL_FOR_INITIATIVE_RECORD_ONLY",
  /** Informational pipeline-stage label — never progress. */
  initiativeStatus: "LEGACY_DO_NOT_USE_FOR_PROGRESS",
  /** Hash / selectedStageId on the experience shell. */
  frontendActiveStageHash: "DISPLAY_ONLY",
  /**
   * Cap02 `buildPipelineStatus` / civic integration widgets — reference UI
   * only. Must never feed experience.currentStageId.
   */
  capability02PipelineStatus: "COMPATIBILITY_DISPLAY_ONLY",
  /**
   * Legacy Activity Collaborative Analysis progressPolicy thresholds
   * (minimumContributions / signals / participants).
   */
  legacyCollaborativeAnalysisThresholds: "COMPATIBILITY_DISPLAY_ONLY",
  /**
   * Legacy Activity Collective Decision quorum / nextLifecycleStage outcome.
   */
  legacyCollectiveDecisionQuorumNextStage: "COMPATIBILITY_DISPLAY_ONLY",
  /**
   * Legacy Activity Implementation Commitment readiness / policy thresholds.
   */
  legacyImplementationCommitmentReadiness: "COMPATIBILITY_DISPLAY_ONLY",
  /**
   * GET /api/v1/initiatives/:id/analysis — COMPATIBILITY_READ_ONLY.
   * Write authority remains initiative-analyses.
   */
  legacyInitiativeAnalysisRoute: "COMPATIBILITY_READ_ONLY",
} as const;

export type InitiativeLifecycleFieldAuthority =
  (typeof INITIATIVE_LIFECYCLE_FIELD_AUTHORITY)[keyof typeof INITIATIVE_LIFECYCLE_FIELD_AUTHORITY];
