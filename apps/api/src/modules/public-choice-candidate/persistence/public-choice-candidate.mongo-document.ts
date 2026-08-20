import type { Document } from "mongodb";

import type { PublicChoiceCandidate } from "@hu/types";

export interface PublicChoiceCandidateMongoDocument extends Document {
  candidateId: string;
  initiativeId: string;
  name: string;
  photoUrl?: string;
  campaignPageUrl?: string;
  sortOrder: number;
  submittedByParticipantId?: string;
  createdAt: string;
  updatedAt: string;
  /** Pack 02C — temporary retention; set at voting close. */
  expireAt?: string;
}

export function toPublicChoiceCandidateMongoDocument(
  candidate: PublicChoiceCandidate,
): PublicChoiceCandidateMongoDocument {
  const document: PublicChoiceCandidateMongoDocument = {
    candidateId: candidate.candidateId,
    initiativeId: candidate.initiativeId,
    name: candidate.name,
    sortOrder: candidate.sortOrder,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };

  if (candidate.photoUrl) {
    document.photoUrl = candidate.photoUrl;
  }
  if (candidate.campaignPageUrl) {
    document.campaignPageUrl = candidate.campaignPageUrl;
  }
  if (candidate.submittedByParticipantId) {
    document.submittedByParticipantId = candidate.submittedByParticipantId;
  }

  return document;
}

export function fromPublicChoiceCandidateMongoDocument(
  document: PublicChoiceCandidateMongoDocument,
): PublicChoiceCandidate {
  return {
    candidateId: document.candidateId,
    initiativeId: document.initiativeId,
    name: document.name,
    photoUrl: document.photoUrl,
    campaignPageUrl: document.campaignPageUrl,
    sortOrder: document.sortOrder,
    submittedByParticipantId: document.submittedByParticipantId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
