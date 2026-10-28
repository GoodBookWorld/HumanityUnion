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
   * Incremented by each Blog author activation in the same transaction as the
   * grant. The write is what makes a concurrent rebind or disconnect conflict.
   */
  authorActivationGuard?: number;
  /**
   * Incremented by each accepted author reply inside its transaction. The write
   * is what makes a concurrent disconnect or rebind wait for, or retry after, the reply.
   */
  linkWriteGuard?: number;
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
  /**
   * Set only by binding recovery. A link with a recovery id cannot be
   * recovered again under a different id.
   */
  bindingRecoveryId?: string;
  bindingRecoveryResultCode?: string;
  bindingRecoveryHuTarget?: string;
  bindingRecoveryReplacedMemberId?: string;
  bindingRecoveryReplacedLinkRevision?: number;
  bindingRecoveryReplacedLinkInstanceId?: string;
}

export interface ExternalAuthorLinkResultRecord {
  resultCode: string;
  source: IntegrityMediaSource;
  attemptState: string;
  memberId: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
  /** Set on recovery codes. When set, binding recovery requires the signed author to match. */
  externalAuthorId?: string;
  /**
   * Present only on a code minted from a verified recovery state. Ordinary
   * redemption treats such a code as unavailable and never consumes it.
   */
  purpose?: "binding_recovery";
  /** Recovery id from the verified state. Recovery redeem requires it to match. */
  bindingRecoveryId?: string;
  /** Deployment target from the verified state. */
  huTarget?: string;
  /**
   * Binding recovery reservation. Ordinary redemption treats a reserved
   * result as unavailable.
   */
  bindingRecoveryReservationId?: string;
}

export type ExternalAuthorLinkRecoveryReceiptStatus = "pending" | "completed" | "rejected";

export interface ExternalAuthorLinkRecoveryOutcome {
  memberId: string;
  linkRevision: number;
  linkInstanceId: string;
  replacedMemberId: string;
  replacedLinkRevision: number;
  replacedLinkInstanceId: string;
}

/**
 * One binding recovery request, keyed by recoveryId. The signature is never stored.
 * A rejected receipt stays bound to its request.
 */
export interface ExternalAuthorLinkRecoveryReceiptRecord {
  recoveryId: string;
  source: IntegrityMediaSource;
  resultCode: string;
  externalAuthorId: string;
  huTarget: string;
  expectedHuMemberId: string;
  expectedHuLinkRevision: number;
  expectedHuLinkInstanceId: string;
  status: ExternalAuthorLinkRecoveryReceiptStatus;
  outcome: ExternalAuthorLinkRecoveryOutcome | null;
  rejectionCode: string | null;
  createdAt: string;
  updatedAt: string;
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
  | "link_acknowledged"
  | "link_binding_recovered";

export interface ExternalAuthorLinkAuditRecord {
  eventId: string;
  action: ExternalAuthorLinkAuditAction;
  source: IntegrityMediaSource;
  memberId: string | null;
  externalAuthorId: string | null;
  attemptStateHash: string | null;
  reason: string | null;
  createdAt: string;
  /** Binding recovery only. Never the result code, email, or signature. */
  recoveryId?: string;
  replacedMemberId?: string;
  linkRevision?: number;
  linkInstanceId?: string;
  replacedLinkRevision?: number;
  replacedLinkInstanceId?: string;
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
