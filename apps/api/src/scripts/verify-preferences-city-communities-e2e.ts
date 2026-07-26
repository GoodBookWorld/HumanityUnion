/**
 * TASK-105F — Preferred Cities & Communities in Preferences verification.
 * Run: npm run verify:preferences-city-communities
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyTypesAndDefaults(): void {
  console.log("1. Types, defaults, and API wiring");

  const types = readRepoFile("packages/types/src/domain/member-preferences.ts");
  const defaults = readRepoFile("apps/api/src/modules/preferences/preferences.defaults.ts");
  const validators = readRepoFile("apps/api/src/modules/preferences/preferences.validators.ts");
  const routes = readRepoFile("apps/api/src/modules/preferences/preferences.routes.ts");

  assert(types.includes("preferredCountryIds"), "ParticipationPreferences must include countries.");
  assert(
    types.includes("preferredCityCommunityIds"),
    "ParticipationPreferences must include city/community ids.",
  );
  assert(
    defaults.includes("preferredCityCommunityIds: []"),
    "Defaults must initialize preferredCityCommunityIds to [].",
  );
  assert(
    validators.includes("preferredCityCommunityIds"),
    "Validators must accept preferredCityCommunityIds.",
  );
  assert(routes.includes('patch("/me"'), "Preferences API must support PATCH /preferences/me");
}

function verifyUiPlacement(): void {
  console.log("2. Preferences UI placement and controls");

  const workspace = readRepoFile(
    "apps/web/src/features/preferences/components/PreferencesWorkspace.tsx",
  );
  const geographyFields = readRepoFile(
    "apps/web/src/features/preferences/components/PreferredGeographyFields.tsx",
  );

  assert(workspace.includes("PreferredGeographyFields"), "Workspace must render geography fields.");
  assert(workspace.includes("Save Preferences"), "Workspace must keep single save button.");
  assert(
    geographyFields.indexOf("Preferred Countries") < geographyFields.indexOf("Preferred regions"),
    "Preferred Countries must appear before Preferred regions.",
  );
  assert(
    geographyFields.indexOf("Preferred regions") <
      geographyFields.indexOf("Preferred Cities / Communities"),
    "Preferred Cities / Communities must appear below Preferred regions.",
  );
  assert(
    geographyFields.includes("GeographyMultiSelect"),
    "Cities field must use searchable multi-select.",
  );
  assert(
    geographyFields.includes("fetchCommunitiesByRegion"),
    "Cities must load from shared geography service per region.",
  );
  assert(
    geographyFields.includes(
      "Some cities were removed because their country or region is no longer selected.",
    ),
    "Cleanup feedback must be visible.",
  );
  assert(
    geographyFields.includes(
      "Select at least one preferred region to choose Cities / Communities.",
    ),
    "Disabled state must explain region requirement.",
  );
  assert(
    !geographyFields.includes("Save Cities") && !geographyFields.includes("Save Regions"),
    "Geography fields must not add separate save buttons.",
  );
}

function verifyPrivacyAndMatching(): void {
  console.log("3. Privacy projection and notification matching");

  const projection = readRepoFile("apps/api/src/modules/participation/participation.projection.ts");
  const matcher = readRepoFile(
    "apps/api/src/modules/notifications/initiative-interest-match.service.ts",
  );
  const geographyMatch = readRepoFile(
    "apps/api/src/modules/preferences/preferences-geography-match.ts",
  );
  const docs = readRepoFile("docs/MEMBER_PREFERENCES.md");

  assert(
    !projection.includes("preferredCityCommunityIds"),
    "Public participation projection must not expose preferred cities.",
  );
  assert(
    matcher.includes("findPreferredGeographyMatchReason"),
    "Interest matcher must use geography precision layer.",
  );
  assert(
    geographyMatch.includes("matchesPreferredCityCommunity"),
    "Geography matcher must support city/community matching.",
  );
  assert(
    docs.includes("preferredCityCommunityIds"),
    "Documentation must describe city persistence.",
  );
  assert(
    docs.includes("Participation Area"),
    "Documentation must distinguish preferences from Participation Area.",
  );
}

async function verifyGeographyRuntime(): Promise<void> {
  console.log("4. Geography dependency and persistence runtime");

  const {
    formatPreferredCityCommunityId,
    formatPreferredRegionId,
    sanitizeParticipationGeography,
  } = await import("@hu/geography");
  const { loadCommunitiesForRegion } =
    await import("../modules/participation-area/participation-area-community.loader.js");
  const { buildDefaultMemberPreferences } =
    await import("../modules/preferences/preferences.defaults.js");
  const { mergePreferencesPatch } =
    await import("../modules/preferences/preferences.validators.js");
  const { findPreferredGeographyMatchReason } =
    await import("../modules/preferences/preferences-geography-match.js");

  const bcCommunities = loadCommunitiesForRegion("CA", "CA-BC");
  assert(
    bcCommunities.some((community) => community.code === "16735" && community.label === "Nelson"),
    "British Columbia must include Nelson (16735).",
  );

  const nelsonId = formatPreferredCityCommunityId("CA", "CA-BC", "16735");
  const vancouver = bcCommunities.find((community) => community.label === "Vancouver");
  assert(Boolean(vancouver), "British Columbia must include Vancouver.");
  const vancouverId = formatPreferredCityCommunityId("CA", "CA-BC", vancouver!.code);
  const kyivRegionId = formatPreferredRegionId("UA", "UA-30");
  const kyivCityId = formatPreferredCityCommunityId("UA", "UA-30", "12345");

  const base = buildDefaultMemberPreferences({ memberId: "member-prefs-city-001" });
  const withGeography = mergePreferencesPatch(base, {
    participationPreferences: {
      preferredCountryIds: ["CA", "UA"],
      preferredRegions: [formatPreferredRegionId("CA", "CA-BC"), kyivRegionId],
      preferredCityCommunityIds: [nelsonId, vancouverId, kyivCityId],
    },
  });

  assert(
    withGeography.participationPreferences.preferredCityCommunityIds.includes(nelsonId),
    "Nelson must persist in preferredCityCommunityIds.",
  );

  const cleaned = sanitizeParticipationGeography({
    ...withGeography.participationPreferences,
    preferredCountryIds: ["CA"],
    preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
  });

  assert(
    cleaned.removedCityCount >= 1,
    "Removing incompatible country must remove incompatible cities.",
  );
  assert(
    !cleaned.participationPreferences.preferredCityCommunityIds.some((entry) =>
      entry.startsWith("UA::"),
    ),
    "Ukraine cities must be removed when Ukraine is deselected.",
  );

  const legacy = mergePreferencesPatch(base, {
    participationPreferences: {
      preferredRegions: ["CA-BC"],
      preferredCountryIds: ["CA"],
    },
  });

  assert(
    legacy.participationPreferences.preferredRegions.some((entry) => entry.includes("CA-BC")),
    "Legacy region records must remain compatible.",
  );
  assert(
    legacy.participationPreferences.preferredCityCommunityIds.length === 0,
    "Missing city field must normalize to [].",
  );

  const initiative = {
    metadata: {
      countrySlug: "CA",
      regionSlug: "CA-BC",
      communitySlug: "16735",
      communityAssociation: "Nelson",
      activityArea: "Environment and Climate",
      tags: [],
      region: "CA-BC",
      language: "en",
    },
  } as never;

  const cityMatch = findPreferredGeographyMatchReason(
    {
      ...base,
      participationPreferences: {
        ...base.participationPreferences,
        preferredCityCommunityIds: [nelsonId],
      },
    },
    initiative,
  );

  assert(cityMatch === "Nelson", "City preference must match initiative community precisely.");
}

async function verifyPreferencesPersistenceRuntime(): Promise<void> {
  console.log("5. Preferences save and reload runtime");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");

  if (!isMongoConfigured()) {
    console.log("   Skipping Mongo-backed preferences runtime checks (MONGODB_URI unset).");
    return;
  }

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { updateMemberPreferencesForAuthUser } =
    await import("../modules/preferences/preferences.service.js");
  const { findPreferencesByMemberId } =
    await import("../modules/preferences/preferences.repository.js");
  const { formatPreferredCityCommunityId, formatPreferredRegionId } = await import("@hu/geography");

  await bootstrapAuthPersistence();

  const email = `prefs-city-${Date.now()}@example.com`;
  const registered = await registerAndConfirmAuthUser({
    email,
    displayName: "Preferences City Verify",
    password: "verify-password-123",
  });

  const nelsonId = formatPreferredCityCommunityId("CA", "CA-BC", "16735");

  const updated = await updateMemberPreferencesForAuthUser(registered.user.memberId, {
    participationPreferences: {
      preferredCountryIds: ["CA"],
      preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
      preferredCityCommunityIds: [nelsonId],
    },
  });

  assert(
    updated.participationPreferences.preferredCityCommunityIds.includes(nelsonId),
    "Saved preferences must include Nelson city id.",
  );

  const reloaded = await findPreferencesByMemberId(registered.user.memberId);
  assert(
    Boolean(reloaded?.participationPreferences.preferredCityCommunityIds.includes(nelsonId)),
    "Reloaded preferences must retain saved city ids.",
  );
}

async function main(): Promise<void> {
  verifyTypesAndDefaults();
  verifyUiPlacement();
  verifyPrivacyAndMatching();
  await verifyGeographyRuntime();
  await verifyPreferencesPersistenceRuntime();
  console.log("\nTASK-105F verify:preferences-city-communities PASS");
}

void runVerificationScript(main);
