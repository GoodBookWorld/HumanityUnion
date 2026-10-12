import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";

export type IntegrityMediaSource = typeof INTEGRITY_MEDIA_SOURCE;

export type ExternalAuthorLinkState = "linked" | "disabled";

/** HU↔IM collaboration control. Distinct from link state and author setup. */
export type IntegrityMediaCollaborationStatus = "active" | "blocked" | "archived";

export interface ExternalAuthorLinkRecord {
  source: IntegrityMediaSource;
  externalAuthorId: string;
  memberId: string;
  state: ExternalAuthorLinkState;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
  /**
   * Absent on links stored before this field existed. Callers must use
   * resolveIntegrityMediaCollaborationStatus, which treats absence as active.
   */
  collaborationStatus?: IntegrityMediaCollaborationStatus;
  /**
   * True only while the proven pair exists and ordinary Blog author setup
   * has not finished. Absent or false once that capability is effective.
   */
  authorActivationPending?: boolean;
  /** Last automatic or exhausted activation attempt. Used only to space retries. */
  authorActivationAttemptAt?: string | null;
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
  | "result_redeemed"
  | "author_capability_ensured"
  | "author_capability_failed"
  | "author_activation_pending"
  | "author_capability_recovered"
  | "integrity_media_disconnect_accepted";

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

/** Accepted IM → HU disconnect. The signature is never stored. */
export interface ExternalAuthorDisconnectEventRecord {
  eventId: string;
  externalAuthorId: string;
  memberId: string;
  createdAt: string;
}
