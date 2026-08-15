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
 * Lifecycle UX Completion Pack 02 Part 6 — a stage is selectable when it is
 * already unlocked by publication progress, or is the single next
 * Not Started stage after the furthest unlocked stage. Further Not Started
 * stages cannot be skipped into.
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

  let furthestUnlocked = -1;

  for (let i = 0; i < stages.length; i += 1) {
    if (UNLOCKED_STATES.has(stages[i]!.state)) {
      furthestUnlocked = i;
    }
  }

  return index <= furthestUnlocked + 1;
}
