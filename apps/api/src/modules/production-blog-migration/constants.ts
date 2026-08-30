/**
 * Production Blog migration — Task 02 read-only preflight constants.
 * Independent of production-initiative-migration.
 */

export const PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE =
  "humanity_union_staging" as const;
export const PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE =
  "humanity_union_production" as const;

/** Explicit dual-connection env vars — never reuse a single service DB as both sides. */
export const BLOG_SOURCE_MONGODB_URI_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_URI" as const;
export const BLOG_SOURCE_MONGODB_DATABASE_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE" as const;
export const BLOG_DESTINATION_MONGODB_URI_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_URI" as const;
export const BLOG_DESTINATION_MONGODB_DATABASE_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_DATABASE" as const;

/** Optional — when unset, R2 object verification is DEFERRED (Mongo preflight still runs). */
export const BLOG_SOURCE_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCOUNT_ID" as const;
export const BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCESS_KEY_ID" as const;
export const BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_SECRET_ACCESS_KEY" as const;
export const BLOG_SOURCE_R2_BUCKET_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_BUCKET" as const;
export const BLOG_DESTINATION_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCOUNT_ID" as const;
export const BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCESS_KEY_ID" as const;
export const BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_SECRET_ACCESS_KEY" as const;
export const BLOG_DESTINATION_R2_BUCKET_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_BUCKET" as const;

export const PRODUCTION_MEDIA_PUBLIC_BASE_URL = "https://media.huws.org" as const;

/** Explicit write confirmation — required with --execute. */
export const PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG =
  "PRODUCTION_BLOG_MIGRATION_CONFIRM" as const;
export const PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE = "YES" as const;

/**
 * Crash-safe Blog execute order.
 * R2 object copy (P2a) runs before the Mongo transaction that commits rewritten
 * production media URLs. Categories (P1) are applied inside that same Mongo
 * transaction after R2 — they have no media URL dependency, but a single
 * transactional boundary is required for all canonical Mongo writes.
 */
export const CRASH_SAFE_BLOG_EXECUTION_ORDER = [
  "P0_preflight",
  "P2a_r2_objects",
  "P1_categories",
  "P2b_media_records",
  "P3_capability_grants",
  "P4_author_applications",
  "P5_posts",
  "P6_reactions",
  "P7_subscribers",
  "P8_publication_deliveries",
  "P9_zero_count_assertions",
  "P10_derived_state",
  "P11_verification",
] as const;

/** Destination Mongo durable recovery collections (migration-only). */
export const BLOG_MEDIA_RECOVERY_COLLECTION =
  "production_blog_migration_media_recovery" as const;
export const BLOG_RUN_RECOVERY_COLLECTION =
  "production_blog_migration_runs" as const;

/** Collections this executor may insert into (execute path only). */
export const BLOG_ALLOWED_WRITE_COLLECTIONS = [
  "blog_categories",
  "blog_posts",
  "blog_subscribers",
  "blog_publication_deliveries",
  "blog_capability_grants",
  "blog_author_applications",
  "blog_reactions",
  "media_upload_records",
  BLOG_MEDIA_RECOVERY_COLLECTION,
  BLOG_RUN_RECOVERY_COLLECTION,
] as const;

/** Never migrate / never write from this executor. */
export const BLOG_FORBIDDEN_MIGRATE_COLLECTIONS = [
  "outbox",
  "processed_events",
  "traffic_events",
  "traffic_sessions",
  "traffic_daily_aggregates",
  "traffic_visitor_first_seen",
  "content_translations",
  "workspace_projections",
  "member_notifications",
  "admin_notifications",
  "email_verification_tokens",
  "email_confirmation_codes",
  "auth_sessions",
  "blog_subscription_settings",
  "blog_admin_subscriber_messages",
  "blog_admin_subscriber_message_deliveries",
  "blog_comments",
] as const;

/** Exact expected staging inventory for controlled Blog migration. */
export const EXPECTED_BLOG_COLLECTION_COUNTS = {
  blog_posts: 14,
  blog_categories: 4,
  blog_subscribers: 17,
  blog_subscription_settings: 0,
  blog_publication_deliveries: 18,
  blog_admin_subscriber_messages: 0,
  blog_admin_subscriber_message_deliveries: 0,
  blog_capability_grants: 3,
  blog_author_applications: 3,
  blog_comments: 0,
  blog_reactions: 3,
} as const;

export const EXPECTED_SEED_CATEGORY_IDS = [
  "conscious_existence",
  "human_security",
  "our_life",
] as const;

export const EXPECTED_INSERT_CATEGORY_ID = "human_potential" as const;

export const EXPECTED_CATEGORY_IDS = [
  ...EXPECTED_SEED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
] as const;

export const BLOG_SUBSCRIPTION_TYPE = "blog_publications" as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}
