/**
 * Phase 05 — deterministic next meaningful Participant action resolver.
 * Pure function: does not mutate lifecycle state.
 */

import type {
  CollectiveParticipationAvailableAction,
  CollectiveParticipationNextAction,
  CollectiveParticipationPastAction,
  InitiativeLifecycleProfile,
  InitiativeLifecycleStageId,
} from "@hu/types";
import {
  getLifecycleStageRouteForProfile,
  isLifecycleStageApplicableToProfile,
} from "@hu/types";

function hasPast(
  pastActions: readonly CollectiveParticipationPastAction[],
  actionType: CollectiveParticipationPastAction["actionType"],
): boolean {
  return pastActions.some((action) => action.actionType === actionType);
}

function pickAvailable(
  available: readonly CollectiveParticipationAvailableAction[],
  actionType: CollectiveParticipationAvailableAction["actionType"],
): CollectiveParticipationAvailableAction | undefined {
  return available.find(
    (action) => action.actionType === actionType && action.eligibility === "eligible",
  );
}

function toNext(
  action: CollectiveParticipationAvailableAction,
  reason: string,
): CollectiveParticipationNextAction {
  return {
    actionType: action.actionType,
    stageId: action.stageId,
    label: action.label,
    deepLink: action.deepLink,
    reason,
  };
}

/**
 * Prefer participation on the current stage; otherwise the first later
 * applicable eligible opportunity. Never suggests NOT_APPLICABLE stages.
 */
export function resolveNextMeaningfulParticipationAction(input: {
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: InitiativeLifecycleStageId;
  readonly pastActions: readonly CollectiveParticipationPastAction[];
  readonly availableActions: readonly CollectiveParticipationAvailableAction[];
  readonly activeAlly: boolean;
}): CollectiveParticipationNextAction | null {
  const { lifecycleProfile, currentStageId, pastActions, availableActions } = input;
  const route = getLifecycleStageRouteForProfile(lifecycleProfile);
  const currentIndex = route.indexOf(currentStageId);

  const preferOnStage = (stageId: InitiativeLifecycleStageId): CollectiveParticipationNextAction | null => {
    if (!isLifecycleStageApplicableToProfile(stageId, lifecycleProfile)) {
      return null;
    }

    if (stageId === "petition") {
      const sign = pickAvailable(availableActions, "petition_signature");
      if (sign && !hasPast(pastActions, "petition_signature")) {
        return toNext(sign, "Petition is open and you have not signed yet.");
      }
      return null;
    }

    if (stageId === "collective_decision") {
      const update = pickAvailable(availableActions, "decision_vote");
      if (update) {
        if (hasPast(pastActions, "decision_vote")) {
          const past = pastActions.find((action) => action.actionType === "decision_vote");
          if (past?.updateable) {
            return toNext(update, "You already voted. You may review or update your vote while voting is open.");
          }
          return null;
        }
        return toNext(update, "Collective Decision voting is open.");
      }
      return null;
    }

    if (stageId === "discussion" || stageId === "initiative") {
      if (!hasPast(pastActions, "discussion_comment")) {
        const comment = availableActions.find(
          (action) =>
            action.actionType === "discussion_comment" && action.eligibility === "eligible",
        );
        if (comment) {
          return toNext(comment, "Join the Discussion for this Initiative.");
        }
      }

      if (!hasPast(pastActions, "support_initiative")) {
        const support = pickAvailable(availableActions, "support_initiative");
        if (support) {
          return toNext(support, "Show support for this Initiative.");
        }
      }
    }

    if (stageId === "commitment") {
      const commitment = pickAvailable(availableActions, "commitment_response");
      if (commitment) {
        return toNext(commitment, "A commitment needs your response.");
      }
    }

    return null;
  };

  const onCurrent = preferOnStage(currentStageId);
  if (onCurrent) {
    return onCurrent;
  }

  // Forward scan only — never regress lifecycle; skip NOT_APPLICABLE via route.
  for (let index = Math.max(currentIndex, 0) + 1; index < route.length; index += 1) {
    const stageId = route[index];
    if (!stageId) {
      continue;
    }
    const candidate = preferOnStage(stageId);
    if (candidate) {
      return candidate;
    }
  }

  // Soft fallback: discussion/support still useful even if current stage is later
  // and participant never engaged — only when those stages remain applicable.
  if (
    isLifecycleStageApplicableToProfile("discussion", lifecycleProfile) &&
    !hasPast(pastActions, "discussion_comment")
  ) {
    const comment = pickAvailable(availableActions, "discussion_comment");
    if (comment) {
      return toNext(comment, "You can still contribute in Discussion.");
    }
  }

  return null;
}
