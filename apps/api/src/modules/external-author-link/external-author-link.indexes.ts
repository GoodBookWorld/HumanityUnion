import type { IndexDescription } from "mongodb";

export const EXTERNAL_AUTHOR_LINK_INDEXES: IndexDescription[] = [
  {
    key: { source: 1, externalAuthorId: 1 },
    unique: true,
    name: "external_author_links_source_author_unique",
  },
  {
    key: { source: 1, memberId: 1 },
    unique: true,
    name: "external_author_links_source_member_unique",
  },
];

export const EXTERNAL_AUTHOR_LINK_RESULT_INDEXES: IndexDescription[] = [
  {
    key: { resultCode: 1 },
    unique: true,
    name: "external_author_link_results_code_unique",
  },
  {
    key: { expiresAt: 1 },
    name: "external_author_link_results_expires_at",
  },
];

export const EXTERNAL_AUTHOR_DISCONNECT_EVENT_INDEXES: IndexDescription[] = [
  {
    key: { eventId: 1 },
    unique: true,
    name: "external_author_disconnect_events_event_id_unique",
  },
];

export const EXTERNAL_AUTHOR_PROVISION_ATTEMPT_INDEXES: IndexDescription[] = [
  {
    key: { attemptId: 1 },
    unique: true,
    name: "external_author_provision_attempts_attempt_id_unique",
  },
];

export const INTEGRITY_MEDIA_ARTICLE_DELIVERY_INDEXES: IndexDescription[] = [
  {
    key: { source: 1, publicationId: 1 },
    unique: true,
    name: "integrity_media_article_deliveries_source_publication_unique",
  },
];

export const EXTERNAL_AUTHOR_SSO_GRANT_INDEXES: IndexDescription[] = [
  {
    key: { grantId: 1 },
    unique: true,
    name: "external_author_sso_grants_grant_id_unique",
  },
  {
    key: { requestId: 1 },
    unique: true,
    name: "external_author_sso_grants_request_id_unique",
  },
];

export const EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES: IndexDescription[] = [
  { key: { createdAt: -1 }, name: "external_author_link_audit_created_at" },
  { key: { action: 1, createdAt: -1 }, name: "external_author_link_audit_action_created" },
];
