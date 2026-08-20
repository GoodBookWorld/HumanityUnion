/**
 * Pack 02C — temporary Final Results snapshot.
 * Frozen at voting close; deleted with the same 72-hour retention as votes/candidates.
 * Not a second voting authority and not a permanent archive.
 */
import type { Document } from "mongodb";

import type {
  InitiativeDecisionBallotAggregates,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";

export interface PublicChoiceResultsSnapshot {
  snapshotId: string;
  initiativeId: string;
  decisionId: string;
  ballotMode: PublicChoiceBallotMode;
  electionTitle: string;
  electionDescription: string;
  geographyLabel: string;
  votingCloseAt: string;
  expiresAt: string;
  totalEffectiveVoters: number;
  ballotAggregates: InitiativeDecisionBallotAggregates;
  candidates: PublicChoiceCandidatePublicProjection[];
  publicUrlPath: string;
  disclaimer: string;
  frozenAt: string;
}

export type PublicChoiceResultsSnapshotDocument = PublicChoiceResultsSnapshot & Document;
