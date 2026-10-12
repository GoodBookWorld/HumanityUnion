/** Integrity Media linking boundary. This is not a general integration framework. */
export const INTEGRITY_MEDIA_SOURCE = "integrity-media" as const;

/** Domain separation: a link-completion signature cannot authorize publication delivery. */
export const INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE = "integrity-media-link-redeem";

/** Domain separation: an IM disconnect signature cannot redeem a link or send a message. */
export const INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE = "integrity-media-author-disconnect";

/**
 * Legacy connections that never received a HU revision. This purpose cannot
 * authorize a numbered generation, and the numbered purpose cannot authorize it.
 */
export const INTEGRITY_MEDIA_AUTHOR_DISCONNECT_INITIAL_PURPOSE =
  "integrity-media-author-disconnect-initial";

export const INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PATH =
  "/api/v1/integrations/integrity-media/author-disconnect";

export const INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER = "x-im-hu-timestamp";
export const INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER = "x-im-hu-signature";

export const INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV = "INTEGRITY_MEDIA_LINK_HMAC_SECRET";
export const INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV = "INTEGRITY_MEDIA_LINK_RETURN_ORIGIN";
export const INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV = "INTEGRITY_MEDIA_LINK_RETURN_PATH";

/** Future Integrity Media completion route. Overridable, never taken from the browser. */
export const DEFAULT_INTEGRITY_MEDIA_RETURN_PATH = "/api/author/humanity-union-link/complete";

export const INTEGRITY_MEDIA_RESULT_TTL_MS = 5 * 60 * 1000;
export const INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS = 5 * 60;

/**
 * Synchronous attempts to finish Blog author setup after the identity pair
 * is already durable. A later server-side recovery uses the same budget.
 */
export const INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS = 3;

/** Matches the Blog scheduled-publish poll: one bounded pass, then the next process tick. */
export const INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS = 60 * 1000;
export const INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS =
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_INTERVAL_MS;
export const INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_LIMIT = 20;

export const INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
export const INTEGRITY_MEDIA_RESULT_CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
export const INTEGRITY_MEDIA_AUTHOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
