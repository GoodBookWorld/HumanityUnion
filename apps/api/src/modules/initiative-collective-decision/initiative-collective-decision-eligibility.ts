import type { DecisionSession, Initiative, InitiativeCollectiveDecisionEligibility } from "@hu/types";

import { getSessionById } from "../decision-session/decision-session.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";

/**
 * Assesses Collective Decision eligibility for an Initiative and Decision
 * Session that the caller has already resolved (Recovery Task 09),
 * mirroring the single-resolution pattern established for Decision Session
 * itself in Recovery Task 08. This is the module-specific eligibility rule
 * consumed by `assertEligibleInitiativeAncestry` in
 * `initiative-collective-decision.service.ts` — it performs no lookups of
 * its own, so a caller that has already resolved both records via the
 * shared ancestry validator and the Decision Session store does not incur
 * additional lookups.
 *
 * Reason precedence (unchanged from the pre-existing behavior): "not found"
 * takes priority over "belongs to a different Initiative", which takes
 * priority over "must be closed", which takes priority over "must have a
 * question". Callers that throw on `reasons[0]` therefore see identical
 * messages, in identical order, to the previous implementation.
 */
export function assessInitiativeCollectiveDecisionEligibilityForResolved(
  initiative: Initiative,
  session: DecisionSession | null,
): InitiativeCollectiveDecisionEligibility {
  const reasons: string[] = [];
  const initiativeId = initiative.initiativeId;

  if (!session) {
    reasons.push("Decision session not found.");
  } else {
    if (session.initiativeId !== initiativeId) {
      reasons.push("Decision session does not belong to this initiative.");
    }

    // Initiative Lifecycle — Part G, Section 10: publishing the Decision
    // Session unlocks Collective Decision. Closed sessions remain eligible
    // (they were already published). Draft/archived sessions do not.
    if (session.status !== "published" && session.status !== "closed") {
      reasons.push("Decision session must be published before opening a collective decision.");
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

export function assessInitiativeCollectiveDecisionEligibility(
  initiativeId: string,
  decisionSessionId: string,
): InitiativeCollectiveDecisionEligibility {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return {
      eligible: false,
      reasons: ["Initiative not found."],
      initiativeVersion: 0,
    };
  }

  const session = getSessionById(decisionSessionId);

  return assessInitiativeCollectiveDecisionEligibilityForResolved(initiative, session);
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
