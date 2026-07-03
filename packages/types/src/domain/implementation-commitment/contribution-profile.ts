import type { ContributionItemId, ParticipantId } from "./identifiers.js";

/** Participant-owned summary of declared preparedness within one Implementation Commitment. */
export interface ContributionProfile {
  participantId: ParticipantId;
  contributionItemIds: ContributionItemId[];
  skillSummary?: string;
  regionalContext?: string;
  organizationalContext?: string;
}
