import type {
  ParticipantSuspensionReasonCode,
  ParticipantSuspensionRecordStatus,
  ParticipantSuspensionReviewRequestStatus,
} from "@hu/types";

/** Internal suspension review request — Admin may see explanation; never email/audit bodies. */
export interface ParticipantSuspensionReviewRequestRecord {
  readonly requestId: string;
  readonly explanation: string;
  readonly createdAt: string;
  readonly status: ParticipantSuspensionReviewRequestStatus;
  readonly resolvedAt?: string;
}

/**
 * Internal suspension record. Stores `reviewTokenHash` only — never expose raw token.
 */
export interface ParticipantSuspensionRecord {
  readonly suspensionId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly reasonCode: ParticipantSuspensionReasonCode;
  readonly suspendedAt: string;
  readonly suspendedByParticipantId: string;
  readonly status: ParticipantSuspensionRecordStatus;
  readonly restoredAt?: string;
  readonly restoredByParticipantId?: string;
  readonly reviewTokenHash?: string;
  readonly reviewTokenExpiresAt?: string;
  readonly reviewTokenConsumedAt?: string;
  readonly reviewRequest?: ParticipantSuspensionReviewRequestRecord;
}

export interface CreateParticipantSuspensionInput {
  readonly participantId: string;
  readonly userId: string;
  readonly reasonCode: ParticipantSuspensionReasonCode;
  readonly suspendedByParticipantId: string;
  readonly reviewTokenHash: string;
  readonly reviewTokenExpiresAt: string;
}

export interface IssuedParticipantSuspension {
  readonly suspension: ParticipantSuspensionRecord;
  /** One-time raw review token — never persist. */
  readonly rawReviewToken: string;
}
