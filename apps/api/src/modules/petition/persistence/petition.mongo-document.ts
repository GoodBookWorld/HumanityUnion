import type { Document } from "mongodb";

import type {
  PetitionPolicy,
  PetitionState,
  PetitionSubject,
  PetitionTraceability,
  ShareLink,
} from "@hu/types";

/**
 * Authoritative, durable Petition definition/lifecycle document.
 *
 * Deliberately excludes `signatures`, `supportMetrics`, and `outcome`: these
 * are derived at read time from the separate `petition_signatures` collection
 * (Recovery Task 23 §12, Recovery Task 24 Part 3/10). Persisting them here
 * would duplicate the Signature aggregate's authority and reintroduce the
 * embedded-array mutation pattern the migration is closing.
 *
 * `traceability` (Initiative Lifecycle — Part F, Section 9) IS persisted
 * directly here, unlike signatures/metrics: it is set once, at creation,
 * from the Initiative Lifecycle "Petition" stage, and never recomputed —
 * the platform's permanent record of which Revision/Proposals/Analysis
 * produced this Petition.
 */
export interface PetitionMongoDocument extends Document {
  petitionId: string;
  collectiveDecisionId: string;
  status: PetitionState;
  createdAt: string;
  updatedAt: string;
  subject: PetitionSubject;
  policy: PetitionPolicy;
  shareLink: ShareLink | null;
  traceability?: PetitionTraceability | null;
}

export interface PetitionMongoRecord {
  petitionId: string;
  collectiveDecisionId: string;
  status: PetitionState;
  createdAt: string;
  updatedAt: string;
  subject: PetitionSubject;
  policy: PetitionPolicy;
  shareLink: ShareLink | null;
  traceability?: PetitionTraceability | null;
}

export function toPetitionMongoDocument(record: PetitionMongoRecord): PetitionMongoDocument {
  return {
    petitionId: record.petitionId,
    collectiveDecisionId: record.collectiveDecisionId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    subject: structuredClone(record.subject),
    policy: structuredClone(record.policy),
    shareLink: record.shareLink ? structuredClone(record.shareLink) : null,
    traceability: record.traceability ? structuredClone(record.traceability) : null,
  };
}

export function fromPetitionMongoDocument(document: PetitionMongoDocument): PetitionMongoRecord {
  return {
    petitionId: document.petitionId,
    collectiveDecisionId: document.collectiveDecisionId,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    subject: structuredClone(document.subject),
    policy: structuredClone(document.policy),
    shareLink: document.shareLink ? structuredClone(document.shareLink) : null,
    traceability: document.traceability ? structuredClone(document.traceability) : null,
  };
}
