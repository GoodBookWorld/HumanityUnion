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

export const EXTERNAL_AUTHOR_LINK_AUDIT_INDEXES: IndexDescription[] = [
  { key: { createdAt: -1 }, name: "external_author_link_audit_created_at" },
  { key: { action: 1, createdAt: -1 }, name: "external_author_link_audit_action_created" },
];
