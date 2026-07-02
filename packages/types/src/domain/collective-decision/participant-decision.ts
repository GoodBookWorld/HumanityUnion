import type { MemberId } from "../member.js";

import type { BallotId } from "./ballot.js";
import type { DecisionOptionId } from "./decision-option.js";

export type ParticipantDecisionId = string;

export type ParticipantDecisionStatus = "submitted" | "superseded";

export interface ParticipantDecision {
  participantDecisionId: ParticipantDecisionId;
  participantId: MemberId;
  ballotId: BallotId;
  selectedOptionIds: DecisionOptionId[];
  submittedAt: string;
  status: ParticipantDecisionStatus;
}
