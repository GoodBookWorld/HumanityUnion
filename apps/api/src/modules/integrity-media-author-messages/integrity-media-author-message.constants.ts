/** Purpose separation from identity-link redemption. Same shared secret, different signed string. */
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE = "humanity-union-author-message";

/**
 * Classified chat. `kind` is its own canonical line and is not part of the content hash.
 * A v1 signature cannot authorize this purpose.
 */
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V2 = "humanity-union-author-message-v2";

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_PATH =
  "/api/integrations/humanity-union/author-messages";

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER =
  "x-hu-integrity-media-timestamp";
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER =
  "x-hu-integrity-media-signature";

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY = "notification" as const;

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_TITLE_MAX_LENGTH = 200;
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH = 8000;
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_LABEL_MAX_LENGTH = 120;
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_CTA_URL_MAX_LENGTH = 2000;

/** Matches the live Integrity Media receive timeout budget. */
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS = 10_000;

/**
 * Same cadence as pending Blog-author activation: one bounded pass per tick,
 * then the next process interval. There is no attempt ceiling — a pending row
 * is kept until delivery or a permanent remote rejection.
 */
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_INTERVAL_MS = 60 * 1000;
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS =
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_INTERVAL_MS;
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_LIMIT = 20;

/** Presentation window for one identity pair. Older rows stay stored. */
export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE = 20;

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_RETRYABLE_ERROR_CODES = [
  "timeout",
  "network",
  "unavailable",
  "not_configured",
  "malformed_response",
  "response_mismatch",
  "delivery_error",
] as const;

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_PERMANENT_ERROR_CODES = [
  "invalid_request",
  "payload_too_large",
  "invalid_cta",
  "invalid_recipient",
  "invalid_signature",
  "stale_timestamp",
  "replayed",
  "message_conflict",
  "link_ineligible",
  "remote_rejected",
] as const;

/**
 * Local chat-delivery stops. A queued chat is not sent after the live link
 * becomes ineligible. These codes are not remote HMAC classifications.
 */
export const INTEGRITY_MEDIA_AUTHOR_CHAT_DELIVERY_STOP_CODES = [
  "link_missing",
  "link_disabled",
  "author_activation_pending",
  "collaboration_blocked",
  "collaboration_archived",
] as const;

export type IntegrityMediaAuthorMessageRetryableErrorCode =
  (typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_RETRYABLE_ERROR_CODES)[number];

export type IntegrityMediaAuthorMessagePermanentErrorCode =
  (typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_PERMANENT_ERROR_CODES)[number];

export type IntegrityMediaAuthorChatDeliveryStopCode =
  (typeof INTEGRITY_MEDIA_AUTHOR_CHAT_DELIVERY_STOP_CODES)[number];

export type IntegrityMediaAuthorMessageErrorCode =
  | IntegrityMediaAuthorMessageRetryableErrorCode
  | IntegrityMediaAuthorMessagePermanentErrorCode
  | IntegrityMediaAuthorChatDeliveryStopCode;
