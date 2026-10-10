import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";

export type IntegrityMediaSource = typeof INTEGRITY_MEDIA_SOURCE;

export type ExternalAuthorLinkState = "linked" | "disabled";

export interface ExternalAuthorLinkRecord {
  source: IntegrityMediaSource;
  externalAuthorId: string;
  memberId: string;
  state: ExternalAuthorLinkState;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
}

export interface ExternalAuthorLinkResultRecord {
  resultCode: string;
  source: IntegrityMediaSource;
  attemptState: string;
  memberId: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export type ExternalAuthorLinkAuditAction =
  | "link_confirmation_created"
  | "link_rejected"
  | "link_expired"
  | "link_conflict"
  | "result_redeemed";

export interface ExternalAuthorLinkAuditRecord {
  eventId: string;
  action: ExternalAuthorLinkAuditAction;
  source: IntegrityMediaSource;
  memberId: string | null;
  externalAuthorId: string | null;
  attemptStateHash: string | null;
  reason: string | null;
  createdAt: string;
}

export type ExternalAuthorLinkConflict = "external_author_already_linked" | "member_already_linked";
