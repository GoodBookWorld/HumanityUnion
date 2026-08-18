import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

const UNLOCKED_STATES = new Set([
  "completed",
  "archived",
  "published",
  "in_progress",
  "draft_saved",
  "preview",
]);

export interface LifecycleStageSelectabilityOptions {
  /**
   * Steward Author — every lifecycleProfile-applicable stage is openable.
   * Status / furthestUnlocked / recommended cursor must not lock Author nav.
   * Non-stewards keep participant next-only unlock.
   */
  readonly viewerIsSteward?: boolean;
}

/**
 * Lifecycle stage click/hash selectability.
 *
 * Author (viewerIsSteward): all applicable stages (not not_applicable /
 * unavailable) — status is informational only.
 *
 * Participant: published/in-progress stages plus the single next Not Started
 * applicable stage after the furthest unlocked applicable stage.
 */
export function isLifecycleStageSelectable(
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  stageId: string,
  options?: LifecycleStageSelectabilityOptions,
): boolean {
  const index = stages.findIndex((stage) => stage.stageId === stageId);
  const stage = index >= 0 ? stages[index] : null;

  if (!stage) {
    return false;
  }

  if (stage.state === "not_applicable" || stage.state === "unavailable") {
    return false;
  }

  if (options?.viewerIsSteward) {
    return true;
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

  // Participants: only the immediate next Not Started after furthest unlocked
  // (not earlier empty gaps — avoids broadening non-steward access).
  return targetOrdinal === furthestUnlockedApplicableOrdinal + 1;
}

/**
 * Guidance cursor: first applicable unfinished stage (Not Started / In Progress),
 * else the last applicable stage. Never used to disable Author stages.
 */
export function resolveRecommendedLifecycleStageId(
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  fallbackStageId?: string,
): string {
  const applicable = stages.filter(
    (stage) => stage.state !== "not_applicable" && stage.state !== "unavailable",
  );

  const unfinished = applicable.find(
    (stage) =>
      stage.state === "not_started" ||
      stage.state === "in_progress" ||
      stage.state === "draft_saved" ||
      stage.state === "preview",
  );

  if (unfinished) {
    return unfinished.stageId;
  }

  if (applicable.length > 0) {
    return applicable[applicable.length - 1]!.stageId;
  }

  return fallbackStageId ?? stages[0]?.stageId ?? "initiative";
}
