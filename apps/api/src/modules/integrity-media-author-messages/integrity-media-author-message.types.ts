import type { IntegrityMediaCollaborationStatus } from "../external-author-link/external-author-link.types.js";
import type { INTEGRITY_MEDIA_SOURCE } from "../external-author-link/external-author-link.constants.js";
import type { INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY } from "./integrity-media-author-message.constants.js";
import type { IntegrityMediaAuthorMessageErrorCode } from "./integrity-media-author-message.constants.js";

export type IntegrityMediaAuthorMessageStatus = "pending" | "delivered" | "failed";

export type IntegrityMediaAuthorMessageDirection = "hu_to_im" | "im_to_hu";

export type IntegrityMediaAuthorMessageKind = "chat" | "system";

export interface IntegrityMediaAuthorMessageCta {
  label: string;
  url: string;
}

/** Durable outbound row. This is the collaboration history. It never stores a secret or signature. */
export interface IntegrityMediaAuthorMessageRecord {
  messageId: string;
  destination: typeof INTEGRITY_MEDIA_SOURCE;
  actorMemberId: string;
  recipientMemberId: string;
  recipientExternalAuthorId: string;
  /**
   * Absent on rows stored before directions existed. Read normalization
   * treats absence as hu_to_im. It is not rewritten in place.
   */
  direction?: IntegrityMediaAuthorMessageDirection;
  /**
   * Absent on rows stored before kinds existed. Read normalization
   * treats absence as system, so historical notifications stay notifications.
   */
  kind?: IntegrityMediaAuthorMessageKind;
  category: typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY;
  title: string;
  body: string;
  cta: IntegrityMediaAuthorMessageCta | null;
  status: IntegrityMediaAuthorMessageStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  lastErrorCode: IntegrityMediaAuthorMessageErrorCode | null;
  createdAt: string;
  updatedAt: string;
}

export type IntegrityMediaAuthorMessageAuditAction =
  | "integrity_media_message_requested"
  | "integrity_media_message_delivered"
  | "integrity_media_message_failed";

export interface IntegrityMediaAuthorMessageAuditRecord {
  eventId: string;
  action: IntegrityMediaAuthorMessageAuditAction;
  messageId: string;
  actorMemberId: string;
  recipientMemberId: string;
  recipientExternalAuthorId: string;
  errorCode: IntegrityMediaAuthorMessageErrorCode | null;
  createdAt: string;
}

/** Latest outbound message shown on an Integrity Authors row. No body or CTA. */
export interface IntegrityMediaAuthorLatestMessageView {
  messageId: string;
  title: string;
  status: IntegrityMediaAuthorMessageStatus;
  lastErrorCode: IntegrityMediaAuthorMessageErrorCode | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface IntegrityMediaAuthorDirectoryRow {
  memberId: string;
  externalAuthorId: string;
  state: "linked" | "disabled";
  authorActivationPending: boolean;
  collaborationStatus: IntegrityMediaCollaborationStatus;
  canSend: boolean;
  createdAt: string;
  confirmedAt: string;
  disconnectedAt: string | null;
  participantDisplayName: string;
  participantAvatarUrl?: string;
  participantProfileHref?: string;
  messageCount: number;
  latestMessage: IntegrityMediaAuthorLatestMessageView | null;
}

export interface IntegrityMediaAuthorDirectoryPage {
  authors: IntegrityMediaAuthorDirectoryRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Safe admin response. No body, recipient author id, secret, or signature. */
export interface IntegrityMediaAuthorMessageDeliveryView {
  messageId: string;
  status: IntegrityMediaAuthorMessageStatus;
  recipientMemberId: string;
  attemptCount: number;
  lastErrorCode: IntegrityMediaAuthorMessageErrorCode | null;
  deliveredAt: string | null;
}

/** One normalized row in an admin history page. No signature, secret, or participant profile. */
export interface IntegrityMediaAuthorMessageHistoryItem {
  messageId: string;
  memberId: string;
  externalAuthorId: string;
  direction: IntegrityMediaAuthorMessageDirection;
  kind: IntegrityMediaAuthorMessageKind;
  body: string;
  createdAt: string;
  title: string | null;
  cta: IntegrityMediaAuthorMessageCta | null;
  actorMemberId: string | null;
  delivery: {
    status: IntegrityMediaAuthorMessageStatus;
    deliveredAt: string | null;
    attemptCount: number;
    lastErrorCode: IntegrityMediaAuthorMessageErrorCode | null;
  } | null;
}

export interface IntegrityMediaAuthorMessageHistoryPage {
  memberId: string;
  messages: IntegrityMediaAuthorMessageHistoryItem[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
