import type { MemberId } from "../member.js";

export type SignatureId = string;

export type SignatureVisibility = "operational" | "restricted" | "public";

export type SignatureStatus = "Active" | "Withdrawn";

export type ParticipationMode = "Community" | "Public";

export interface Signature {
  signatureId: SignatureId;
  petitionId: string;
  participantId: MemberId;
  signedAt: string;
  visibility: SignatureVisibility;
  status: SignatureStatus;
  participationMode?: ParticipationMode;
}
