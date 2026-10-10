/** Integrity Media linking boundary. This is not a general integration framework. */
export const INTEGRITY_MEDIA_SOURCE = "integrity-media" as const;

/** Domain separation: a link-completion signature cannot authorize publication delivery. */
export const INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE = "integrity-media-link-redeem";

export const INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV = "INTEGRITY_MEDIA_LINK_HMAC_SECRET";
export const INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV = "INTEGRITY_MEDIA_LINK_RETURN_ORIGIN";
export const INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV = "INTEGRITY_MEDIA_LINK_RETURN_PATH";

/** Future Integrity Media completion route. Overridable, never taken from the browser. */
export const DEFAULT_INTEGRITY_MEDIA_RETURN_PATH = "/api/author/humanity-union-link/complete";

export const INTEGRITY_MEDIA_RESULT_TTL_MS = 5 * 60 * 1000;
export const INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS = 5 * 60;

export const INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
export const INTEGRITY_MEDIA_RESULT_CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
export const INTEGRITY_MEDIA_AUTHOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
