import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

const UNLOCKED_STATES = new Set([
  "completed",
  "archived",
  "published",
  "in_progress",
  "draft_saved",
  "preview",
]);

/**
 * Lifecycle UX Completion Pack 02 Part 6 + Phase 03 profile-awareness —
 * a stage is selectable when already unlocked by publication progress, or
 * is the single next applicable Not Started stage after the furthest
 * unlocked *applicable* stage. NOT_APPLICABLE stages are skipped (never
 * treated as the "next" gate).
 */
export function isLifecycleStageSelectable(
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  stageId: string,
): boolean {
  const index = stages.findIndex((stage) => stage.stageId === stageId);
  const stage = index >= 0 ? stages[index] : null;

  if (!stage) {
    return false;
  }

  if (stage.state === "not_applicable" || stage.state === "unavailable") {
    return false;
  }

  if (UNLOCKED_STATES.has(stage.state)) {
    return true;
  }

  const applicableIndexes: number[] = [];

  for (let i = 0; i < stages.length; i += 1) {
    const item = stages[i]!;
    if (item.state !== "not_applicable" && item.state !== "unavailable") {
      applicableIndexes.push(i);
    }
  }

  let furthestUnlockedApplicableOrdinal = -1;

  for (let ordinal = 0; ordinal < applicableIndexes.length; ordinal += 1) {
    const stageIndex = applicableIndexes[ordinal]!;
    if (UNLOCKED_STATES.has(stages[stageIndex]!.state)) {
      furthestUnlockedApplicableOrdinal = ordinal;
    }
  }

  const targetOrdinal = applicableIndexes.indexOf(index);
  if (targetOrdinal < 0) {
    return false;
  }

  return targetOrdinal <= furthestUnlockedApplicableOrdinal + 1;
}
