import type { CivicNominationId } from "./civic-nomination.js";
import type {
  CivicNominationVotingResult,
  CivicNominationVotingSessionStatus,
} from "./civic-nomination-voting.js";
import type { ParticipationScope } from "./initiative-collective-decision.js";

/** Privacy-safe public voting projection — aggregates only, no voter identity. */
export interface PublicCivicNominationVotingProjection {
  nominationId: CivicNominationId;
  status: CivicNominationVotingSessionStatus;
  participationScope: ParticipationScope;
  openedAt?: string;
  closesAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  result: CivicNominationVotingResult;
  legalNotice: string;
  transparencyNote: string;
}
