import type { InitiativeLifecycleStageId, LifecycleSafetySurfaceId } from "@hu/types";

/**
 * Safety Architecture Pack 01 Part 5 — maps Lifecycle stage ids to the
 * Safety surface every write path must use.
 */
export function safetySurfaceForLifecycleStage(
  stageId: InitiativeLifecycleStageId,
): LifecycleSafetySurfaceId {
  return stageId;
}

export const DISCUSSION_SAFETY_SURFACE: LifecycleSafetySurfaceId = "discussion";
export const AI_PROMPT_SAFETY_SURFACE: LifecycleSafetySurfaceId = "ai_prompt";
