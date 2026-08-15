import type { Document } from "mongodb";

import type { ParticipationMode, Signature, SignatureStatus, SignatureVisibility } from "@hu/types";

/**
 * Separate, immutable Petition Signature participation document.
 *
 * `initiativeId` is an intentional duplication of the Petition's validated,
 * immutable Initiative ancestry at the moment of signing (Recovery Task 23
 * §12 schema decision; Recovery Task 24 Part 4). It exists only so the
 * signing service can assert `signature.initiativeId === petition.subject
 * .initiativeId` before insert and so future ancestry-scoped queries do not
 * require a join back to the Petition document. It is never exposed on the
 * externally visible `Signature` response shape.
 */
export interface PetitionSignatureMongoDocument extends Document {
  signatureId: string;
  petitionId: string;
  initiativeId: string;
  memberId: string;
  participationMode?: ParticipationMode;
  signedAt: string;
  visibility: SignatureVisibility;
  status: SignatureStatus;
}

export interface PetitionSignatureMongoRecord {
  signatureId: string;
  petitionId: string;
  initiativeId: string;
  memberId: string;
  participationMode?: ParticipationMode;
  signedAt: string;
  visibility: SignatureVisibility;
  status: SignatureStatus;
}

export function toPetitionSignatureMongoDocument(
  record: PetitionSignatureMongoRecord,
): PetitionSignatureMongoDocument {
  return {
    signatureId: record.signatureId,
    petitionId: record.petitionId,
    initiativeId: record.initiativeId,
    memberId: record.memberId,
    participationMode: record.participationMode,
    signedAt: record.signedAt,
    visibility: record.visibility,
    status: record.status,
  };
}

export function fromPetitionSignatureMongoDocument(
  document: PetitionSignatureMongoDocument,
): PetitionSignatureMongoRecord {
  return {
    signatureId: document.signatureId,
    petitionId: document.petitionId,
    initiativeId: document.initiativeId,
    memberId: document.memberId,
    participationMode: document.participationMode,
    signedAt: document.signedAt,
    visibility: document.visibility,
    status: document.status,
  };
}

/** Maps a persisted Signature document to the externally visible `Signature` shape. */
export function toSignatureResponse(record: PetitionSignatureMongoRecord): Signature {
  return {
    signatureId: record.signatureId,
    petitionId: record.petitionId,
    participantId: record.memberId,
    signedAt: record.signedAt,
    visibility: record.visibility,
    status: record.status,
    participationMode: record.participationMode,
  };
}
