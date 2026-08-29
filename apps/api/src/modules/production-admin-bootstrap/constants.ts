/**
 * Production Admin identity bootstrap — Task 06.4.
 * Hard allow-list only. Never infer Admin from displayName/email/publicName.
 */

export const PRODUCTION_ADMIN_BOOTSTRAP_DATABASE = "humanity_union_production";

/** Shared production write confirmation (same value family as steward bootstrap). */
export const PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG =
  "PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM" as const;
export const PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE = "YES" as const;

/** Additional explicit Admin bootstrap confirmation. */
export const PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG =
  "PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM" as const;
export const PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE = "YES" as const;

export const PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV =
  "PRODUCTION_ADMIN_SOURCE_MANIFEST" as const;

export const ADMIN_SOURCE_MANIFEST_VERSION = 1 as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

/**
 * Exact allow-listed production Admin identity.
 * Only this identity may be created with auth_users.role = "admin".
 */
export const APPROVED_PRODUCTION_ADMIN = {
  key: "volody",
  label: "Volody",
  memberId: "58229b2a-adff-4aa0-bb0e-b4d210248ecf",
  userId: "13561681-8a25-4bb7-ab97-f9c9e61870bb",
  profileId: "82f70df3-cb47-4221-96c5-0e154c9834c5",
  displayName: "Volody",
  publicName: "@volody",
  uniqueName: "vlad-6038da",
  authRole: "admin" as const,
} as const;

/** The four steward identities that must remain untouched by Admin bootstrap. */
export const PROTECTED_PRODUCTION_STEWARD_IDS = [
  {
    label: "Vlad Shapran",
    memberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    userId: "5a56a3fd-58d1-41b3-be64-c15ca3e93a28",
  },
  {
    label: "Leonardo",
    memberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    userId: "2e3375dd-dfb1-42a2-8ce2-98a9022cbaae",
  },
  {
    label: "Derek Jennett",
    memberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    userId: "0bf8690c-5e07-4fff-8acb-d56722d5ce80",
  },
  {
    label: "Munia Khan",
    memberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    userId: "7e876d38-0c1e-4241-b520-44bdfc11781a",
  },
] as const;

export function isProductionAdminBootstrapDatabase(database: string): boolean {
  return database.trim() === PRODUCTION_ADMIN_BOOTSTRAP_DATABASE;
}

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}

export function isAllowedAdminBootstrapTargetDatabase(
  database: string,
  options: { allowTestIsolation?: boolean } = {},
): boolean {
  if (isProductionAdminBootstrapDatabase(database)) {
    return true;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(database)) {
    return true;
  }
  return false;
}
