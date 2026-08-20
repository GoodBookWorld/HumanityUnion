/**
 * Public Choice Architecture Pack 02A — Decision Vote ballot payload helpers.
 * Persistence choice values stay canonical; SELECT_ONE uses choice "candidate".
 */

import type { InitiativeDecisionVoteChoice } from "./initiative-decision-vote.js";
import type { PublicChoiceBallotMode } from "./public-choice-ballot-mode.js";

/** Extended choice set: Pack 02A adds `candidate` for SELECT_ONE_CANDIDATE selections. */
export type InitiativeDecisionVoteChoiceExtended =
  | InitiativeDecisionVoteChoice
  | "candidate";

export const INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED = [
  "support",
  "do_not_support",
  "abstain",
  "candidate",
] as const satisfies readonly InitiativeDecisionVoteChoiceExtended[];

export type InitiativeDecisionVoterKind = "participant" | "visitor";

export interface CastInitiativeDecisionVotePayload {
  readonly choice: InitiativeDecisionVoteChoiceExtended;
  /** Required when choice === "candidate" (SELECT_ONE_CANDIDATE). */
  readonly candidateId?: string;
}

export function validateVotePayloadForBallotMode(
  ballotMode: PublicChoiceBallotMode,
  payload: CastInitiativeDecisionVotePayload,
): { ok: true } | { ok: false; reason: string } {
  if (ballotMode === "SUPPORT_OPPOSE") {
    if (payload.candidateId) {
      return { ok: false, reason: "candidateId is not allowed in SUPPORT_OPPOSE ballot mode." };
    }

    if (payload.choice === "candidate") {
      return { ok: false, reason: "candidate choice is not allowed in SUPPORT_OPPOSE ballot mode." };
    }

    if (
      payload.choice !== "support" &&
      payload.choice !== "do_not_support" &&
      payload.choice !== "abstain"
    ) {
      return { ok: false, reason: "Choice must be support, do_not_support, or abstain." };
    }

    return { ok: true };
  }

  // SELECT_ONE_CANDIDATE
  if (payload.choice === "abstain") {
    if (payload.candidateId) {
      return { ok: false, reason: "Abstain must not include a candidateId." };
    }

    return { ok: true };
  }

  if (payload.choice === "candidate") {
    if (!payload.candidateId?.trim()) {
      return { ok: false, reason: "candidateId is required when selecting a candidate." };
    }

    return { ok: true };
  }

  return {
    ok: false,
    reason: "SELECT_ONE_CANDIDATE accepts only a candidate selection or abstain.",
  };
}
