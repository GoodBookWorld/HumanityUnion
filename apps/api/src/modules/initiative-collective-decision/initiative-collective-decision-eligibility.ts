import type { InitiativeCollectiveDecisionEligibility } from "@hu/types";

import { getSessionById } from "../decision-session/decision-session.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";

export function assessInitiativeCollectiveDecisionEligibility(
  initiativeId: string,
  decisionSessionId: string,
): InitiativeCollectiveDecisionEligibility {
  const reasons: string[] = [];
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return {
      eligible: false,
      reasons: ["Initiative not found."],
      initiativeVersion: 0,
    };
  }

  const session = getSessionById(decisionSessionId);

  if (!session) {
    reasons.push("Decision session not found.");
  } else {
    if (session.initiativeId !== initiativeId) {
      reasons.push("Decision session does not belong to this initiative.");
    }

    if (session.status !== "closed") {
      reasons.push("Decision session must be closed before opening a collective decision.");
    }

    if (!session.decisionQuestion.trim()) {
      reasons.push("Decision session must have a non-empty decision question.");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    decisionSessionId: session?.sessionId,
    initiativeVersion: getCurrentPublishedVersion(initiativeId),
  };
}

export function assertInitiativeCollectiveDecisionEligible(
  initiativeId: string,
  decisionSessionId: string,
): { initiativeVersion: number } {
  const eligibility = assessInitiativeCollectiveDecisionEligibility(
    initiativeId,
    decisionSessionId,
  );

  if (!eligibility.eligible) {
    throw new Error(
      eligibility.reasons[0] ?? "Initiative is not eligible for a collective decision.",
    );
  }

  return {
    initiativeVersion: eligibility.initiativeVersion,
  };
}
