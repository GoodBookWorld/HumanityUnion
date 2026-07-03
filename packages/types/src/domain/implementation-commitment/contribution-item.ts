import type { Availability } from "./availability.js";
import type { CommitmentStatus } from "./commitment-status.js";
import type { CommitmentContributionType } from "./contribution-type.js";
import type {
  ContributionItemId,
  ImplementationCommitmentId,
  ParticipantId,
} from "./identifiers.js";

export interface ContributionItem {
  contributionItemId: ContributionItemId;
  implementationCommitmentId: ImplementationCommitmentId;
  participantId: ParticipantId;
  contributionType: CommitmentContributionType;
  /** Declared measurable capacity in domain terms (hours, scope, quantity, etc.). */
  contributionCapacity: string;
  availability: Availability;
  commitmentStatus: CommitmentStatus;
  declaredAt: string;
  updatedAt: string;
  withdrawnAt?: string;
}
