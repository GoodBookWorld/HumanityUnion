import { apiRequest } from "../../lib/api-client";

export interface InitiativeDiscussionCompletion {
  readonly completionId: string;
  readonly initiativeId: string;
  readonly completedByParticipantId: string;
  readonly completedAt: string;
}

/**
 * Phase 04 — explicit Author action to complete Discussion for lifecycle
 * progression. Idempotent. Does not invent a parallel Discussion document.
 */
export async function completeInitiativeDiscussionStage(
  initiativeId: string,
): Promise<InitiativeDiscussionCompletion> {
  return apiRequest<InitiativeDiscussionCompletion>(
    `/api/v1/initiative-discussion-lifecycle/initiative/${encodeURIComponent(initiativeId)}/complete`,
    { method: "POST" },
  );
}
