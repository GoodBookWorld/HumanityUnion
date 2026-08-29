/**
 * Production Initiative migration — Task 05 steward identity bootstrap.
 * Canonical allow-list only (no emails). Emails come from a private source manifest.
 */

export const PRODUCTION_STEWARD_BOOTSTRAP_DATABASE = "humanity_union_production";

export const PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG =
  "PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM" as const;

export const PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE = "YES" as const;

export const PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV =
  "PRODUCTION_STEWARD_SOURCE_MANIFEST" as const;

export const SOURCE_MANIFEST_VERSION = 1 as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

/** Exact canonical stewards — IDs and uniqueness keys must match source manifest. */
export const APPROVED_PRODUCTION_STEWARDS = [
  {
    key: "vlad_shapran",
    label: "Vlad Shapran",
    memberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    userId: "5a56a3fd-58d1-41b3-be64-c15ca3e93a28",
    profileId: "c7ef47df-1078-41c6-bf96-b545d1508dc9",
    publicName: "vlad-shapran",
    uniqueName: "vlad-a5e65d2f",
  },
  {
    key: "leonardo",
    label: "Leonardo",
    memberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    userId: "2e3375dd-dfb1-42a2-8ce2-98a9022cbaae",
    profileId: "97e5c58e-502c-4f6e-9e4b-d22621d56225",
    publicName: "leonardo-6a91cb",
    /** Legacy staging uniqueName — do not "correct" during bootstrap. */
    uniqueName: "michael-9cde6a4e",
  },
  {
    key: "derek_jennett",
    label: "Derek Jennett",
    memberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    userId: "0bf8690c-5e07-4fff-8acb-d56722d5ce80",
    profileId: "b7fb919a-d7aa-4cf9-8fb8-5546f6cb1ad6",
    publicName: "derek-jennett",
    uniqueName: "derek-1c6857",
  },
  {
    key: "munia_khan",
    label: "Munia Khan",
    memberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    userId: "7e876d38-0c1e-4241-b520-44bdfc11781a",
    profileId: "5c0b5c68-7c01-43e7-b456-30e392bb4544",
    publicName: "munia-hhan",
    /** Legacy staging uniqueName — do not "correct" during bootstrap. */
    uniqueName: "isabella-2dfd0e",
  },
] as const;

export type ApprovedProductionSteward = (typeof APPROVED_PRODUCTION_STEWARDS)[number];

export function isProductionStewardBootstrapDatabase(database: string): boolean {
  return database.trim() === PRODUCTION_STEWARD_BOOTSTRAP_DATABASE;
}

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}

/**
 * Production script: only humanity_union_production.
 * Tests may pass allowTestIsolation to use hu_test_* databases.
 */
export function isAllowedBootstrapTargetDatabase(
  database: string,
  options: { allowTestIsolation?: boolean } = {},
): boolean {
  if (isProductionStewardBootstrapDatabase(database)) {
    return true;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(database)) {
    return true;
  }
  return false;
}
