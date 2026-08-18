/**
 * Pure lifecycle navigation helpers for the public Initiative Experience.
 *
 * Kept free of petition/Mongo/store imports so unit tests can exercise
 * profile-aware progress without connecting to infrastructure.
 */

import type {
  Initiative,
  InitiativeExperienceLifecycleStageState,
  InitiativeLifecycleProfile,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageNavItem,
} from "@hu/types";
import {
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES as EXPERIENCE_STAGES,
  isLifecycleStageApplicableToProfile,
  resolveInitiativeLifecycleProfile,
  resolveInitiativeLifecycleState,
} from "@hu/types";

/**
 * Lifecycle UX Completion Pack 02 Part 1 — menu labels derived from
 * publication metadata, never static "Upcoming" placeholders.
 */
const STATE_LABELS: Record<InitiativeExperienceLifecycleStageState, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  draft_saved: "Draft Saved",
  preview: "Preview",
  published: "Published",
  completed: "Completed",
  archived: "Archived",
  not_applicable: "Not applicable",
  unavailable: "Unavailable",
};

/**
 * Current stage is the first unpublished applicable stage after the furthest
 * published Lifecycle artifact. Never derived from `Initiative.status`.
 *
 * Phase 02 — delegates to the shared profile-aware lifecycle state resolver.
 */
export function resolveCurrentStageIdFromPublicationMetadata(
  stageCounts: Map<string, number>,
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): string {
  return resolveInitiativeLifecycleState({
    lifecycleProfile,
    publishedStageCounts: stageCounts,
  }).currentStageId;
}

/**
 * Petition applicability is profile-driven only. `Initiative.status` must
 * not decide whether the Petition stage is on this Initiative's route.
 */
function isPetitionStageApplicable(initiative: Initiative): boolean {
  return isLifecycleStageApplicableToProfile("petition", initiative.lifecycleProfile);
}

/**
 * Derive menu state + marker class from publication metadata, registry order,
 * and LifecycleProfile applicability.
 *
 * AUTHORITY FREEZE — this is the canonical nav derivation for
 * `experience.lifecycleStages` / `currentStageId`. It must never consult
 * Cap02 pipeline status, Initiative.status, frontend hash, community
 * engagement counts, or legacy Activity quorum/threshold helpers.
 *
 * Optional `inProgressStageIds` marks stages that have started working
 * artifacts (e.g. Collaborative Analysis draft) but are not yet published.
 * Viewer identity never enters this function.
 */
export function buildLifecycleNavigation(
  initiative: Initiative,
  stageRecords: Map<string, PublicInitiativeLifecycleRecordItem[]>,
  options?: {
    readonly inProgressStageIds?: ReadonlySet<string> | readonly string[];
  },
): {
  stages: PublicInitiativeLifecycleStageNavItem[];
  currentStageId: string;
} {
  const stageCounts = new Map<string, number>();

  for (const [stageId, items] of stageRecords.entries()) {
    stageCounts.set(stageId, items.length);
  }

  // Initiative record itself is always present for a public experience.
  if ((stageCounts.get("initiative") ?? 0) === 0) {
    stageCounts.set("initiative", 1);
  }

  const inProgressStageIds = new Set(
    options?.inProgressStageIds
      ? Array.from(options.inProgressStageIds)
      : [],
  );

  const lifecycleProfile = resolveInitiativeLifecycleProfile(initiative.lifecycleProfile);
  const currentStageId = resolveCurrentStageIdFromPublicationMetadata(stageCounts, lifecycleProfile);
  const currentIndex = EXPERIENCE_STAGES.findIndex((stage) => stage.stageId === currentStageId);

  const stages: PublicInitiativeLifecycleStageNavItem[] = EXPERIENCE_STAGES.map((stage, index) => {
    const recordCount = stageCounts.get(stage.stageId) ?? 0;
    let state: InitiativeExperienceLifecycleStageState;

    if (
      !isLifecycleStageApplicableToProfile(stage.stageId, lifecycleProfile) ||
      (stage.stageId === "petition" && !isPetitionStageApplicable(initiative))
    ) {
      state = "not_applicable";
    } else if (stage.stageId === "archive" && recordCount > 0) {
      state = "archived";
    } else if (recordCount > 0) {
      // Published artifacts always win — never label a published stage
      // Not Started even if currentStageId temporarily sits earlier.
      state = index === currentIndex ? "published" : "completed";
    } else if (inProgressStageIds.has(stage.stageId) || index === currentIndex) {
      state = "in_progress";
    } else if (index < currentIndex) {
      state = "not_applicable";
    } else {
      state = "not_started";
    }

    return {
      stageId: stage.stageId,
      label: stage.label,
      hash: stage.hash,
      state,
      stateLabel: STATE_LABELS[state],
      recordCount,
    };
  });

  return { stages, currentStageId };
}

export function resolveExperienceStageFromHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const stage = EXPERIENCE_STAGES.find((item) => item.hash === normalized);
  return stage?.stageId ?? null;
}
