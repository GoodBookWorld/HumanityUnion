import type { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";

export type IntegrityMediaSource = typeof INTEGRITY_MEDIA_SOURCE;

export type ExternalAuthorLinkState = "linked" | "disabled";

/**
 * Finalization of a link created under the acknowledgement protocol.
 * Absent on rows stored before the protocol. Absence is legacy unknown:
 * those rows keep their existing operational behavior and are not migrated.
 */
export type ExternalAuthorLinkFinalization = "provisional" | "confirmed";

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
  /**
   * Confirmed connection generation for this identity pair. Absent on rows
   * stored before revisions existed. Absence is not generation zero.
   * The initial generation is assigned as 1. Reconnect advances it and
   * never resets it.
   */
  linkRevision?: number;
  /**
   * Server-minted id of this link instance. A reconnect of a protocol row
   * mints another one. Absent on legacy rows.
   */
  linkInstanceId?: string;
  /** Absent on legacy rows. Those rows are not provisional and are not backfilled. */
  linkFinalization?: ExternalAuthorLinkFinalization;
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
  | "integrity_media_disconnect_accepted"
  | "link_acknowledged";

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
export type ExternalAuthorDisconnectOutcome = "disabled" | "superseded";

export interface ExternalAuthorDisconnectEventRecord {
  eventId: string;
  externalAuthorId: string;
  memberId: string;
  /** Null means the initial-generation protocol, which carries no numeric revision. */
  linkRevision: number | null;
  outcome: ExternalAuthorDisconnectOutcome;
  createdAt: string;
}
