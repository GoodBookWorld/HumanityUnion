/** Integrity Media linking boundary. This is not a general integration framework. */
export const INTEGRITY_MEDIA_SOURCE = "integrity-media" as const;

/** Domain separation: a link-completion signature cannot authorize publication delivery. */
export const INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE = "integrity-media-link-redeem";

/**
 * Domain separation: an acknowledgement cannot redeem, disconnect, reply, or release.
 * Integrity Media sends it only after its own connected write.
 */
export const INTEGRITY_MEDIA_LINK_ACKNOWLEDGE_PURPOSE = "integrity-media-link-acknowledge";

/**
 * IM → HU rebinding of one confirmed author link to the participant proven by a
 * confirmation result. Redeem, acknowledge, disconnect, and reply signatures
 * cannot authorize it, and this purpose cannot authorize those flows.
 */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_PURPOSE = "integrity-media-binding-recovery-redeem";

/** Recovery is enabled only when the trimmed value is exactly `true`. */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED_ENV =
  "INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED";

export const INTEGRITY_MEDIA_RECOVERY_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Signed Binding Recovery confirmation state (Workflow 06B, version 1).
 * A state signature cannot authorize a redeem, acknowledgement, disconnect,
 * reply, provision, SSO, or article request, and those cannot authorize a state.
 */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_PURPOSE =
  "integrity-media-binding-recovery-state";

/** Any state starting with `hur` and a digit is a recovery state. It never falls back. */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FAMILY_PATTERN = /^hur[0-9]/;

/**
 * tag, target, issuedAt, expiresAt, externalAuthorId (UUID v4 hex without dashes),
 * nonce, recoveryId (16 to 48), lowercase hex HMAC. Length 159 to 191.
 */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_V1_PATTERN =
  /^hur1([ps])(\d{10})(\d{10})([0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})([A-Za-z0-9_-]{22})([A-Za-z0-9_-]{16,48})([0-9a-f]{64})$/;

export const INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_MAX_LIFETIME_SECONDS = 600;
export const INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FUTURE_SKEW_SECONDS = 60;

/** Purpose stored on a confirmation code minted from a verified recovery state. */
export const INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE = "binding_recovery";

/**
 * IM → HU account provision attempt. A redeem or acknowledgement signature
 * cannot register an attempt, and this purpose cannot redeem or confirm.
 */
export const INTEGRITY_MEDIA_ACCOUNT_PROVISION_ATTEMPT_PURPOSE =
  "integrity-media-account-provision-attempt";

/**
 * IM → HU declaration that this attempt requires a version-2 snapshot.
 * A ten-field signature cannot make this declaration, and this purpose
 * cannot register an attempt by itself.
 */
export const INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE =
  "integrity-media-account-provision-version";

export const INTEGRITY_MEDIA_PROVISION_VERSION_TIMESTAMP_HEADER =
  "x-hu-integrity-media-version-timestamp";

export const INTEGRITY_MEDIA_PROVISION_VERSION_SIGNATURE_HEADER =
  "x-hu-integrity-media-version-signature";

/**
 * IM → HU public profile snapshot. A provision-attempt signature cannot
 * register a snapshot, and this purpose cannot create an account by itself.
 */
export const INTEGRITY_MEDIA_ACCOUNT_PROVISION_SNAPSHOT_PURPOSE =
  "integrity-media-account-provision-snapshot";

/** Closed version accepted by the snapshot registration endpoint. */
export const INTEGRITY_MEDIA_PROVISION_SNAPSHOT_VERSION = 2;

/**
 * IM → HU passwordless sign-in. A provision, redeem, or acknowledgement
 * signature cannot mint an SSO grant, and this purpose cannot create an account.
 */
export const INTEGRITY_MEDIA_ACCOUNT_SSO_PURPOSE = "integrity-media-account-sso";

/** Browser grant lifetime. Shorter than the signature replay window. */
export const INTEGRITY_MEDIA_SSO_GRANT_TTL_MS = 60 * 1000;

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

/**
 * IM → HU author reply. A disconnect or redeem signature cannot authorize a reply.
 * Same shared link secret. The signed string starts with this purpose.
 */
export const INTEGRITY_MEDIA_AUTHOR_REPLY_PURPOSE = "integrity-media-author-reply";

export const INTEGRITY_MEDIA_AUTHOR_REPLY_PATH =
  "/api/v1/integrations/integrity-media/author-reply";

export const INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV = "INTEGRITY_MEDIA_LINK_HMAC_SECRET";

/**
 * IM → HU article delivery. A link, provision, SSO, or disconnect signature
 * cannot ingest an article, and this purpose cannot authorize those flows.
 * The secret is dedicated and is never the browser session.
 */
export const INTEGRITY_MEDIA_ARTICLE_INGEST_PURPOSE = "integrity-media-article-ingest";

export const INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV =
  "INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET";

/**
 * Active HU Blog category id for ingested articles.
 * This is the whole mapping. Sphere slugs are not accepted and are not guessed.
 */
export const INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV = "INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID";

export const INTEGRITY_MEDIA_ARTICLE_INGEST_PATH =
  "/api/v1/integrations/integrity-media/articles";

export const INTEGRITY_MEDIA_ARTICLE_TIMESTAMP_HEADER =
  "x-hu-integrity-media-article-timestamp";

export const INTEGRITY_MEDIA_ARTICLE_SIGNATURE_HEADER =
  "x-hu-integrity-media-article-signature";
export const INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV = "INTEGRITY_MEDIA_LINK_RETURN_ORIGIN";
export const INTEGRITY_MEDIA_LINK_RETURN_PATH_ENV = "INTEGRITY_MEDIA_LINK_RETURN_PATH";

/** Trusted Integrity Media server origin. Never taken from a snapshot or browser. */
export const INTEGRITY_MEDIA_SERVER_ORIGIN_ENV = "INTEGRITY_MEDIA_SERVER_ORIGIN";

/** IM → HU frozen WEBP retrieval. This purpose cannot register or confirm an attempt. */
export const INTEGRITY_MEDIA_PROVISION_PHOTO_PURPOSE = "integrity-media-provision-photo";

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
