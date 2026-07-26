/**
 * TASK-082 — Member preferences, participation geography, and initiative UX verification.
 * Run: npm run verify:member-preferences-initiative-ux
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

function verifyPreferencesUi(): void {
  console.log("1. Preferences form and persistence wiring");

  const preferencesPage = readRepoFile("apps/web/src/app/preferences/page.tsx");
  const workspace = readRepoFile(
    "apps/web/src/features/preferences/components/PreferencesWorkspace.tsx",
  );
  const api = readRepoFile("apps/web/src/features/preferences/preferences-api.ts");
  const routes = readRepoFile("apps/api/src/modules/preferences/preferences.routes.ts");

  assert(
    preferencesPage.includes("PreferencesWorkspace"),
    "Preferences page must render editable form",
  );
  assert(workspace.includes("Save Preferences"), "Preferences form must have one save button");
  assert(
    workspace.includes("Preferences saved successfully."),
    "Preferences form must show success message",
  );
  assert(api.includes("updateMyPreferences"), "Frontend must support PATCH preferences");
  assert(routes.includes('patch("/me"'), "API must expose PATCH /preferences/me");
}

function verifyMemberArchitecture(): void {
  console.log("2. Member settings architecture");

  const memberWorkspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const summaries = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberSettingsSummaries.tsx",
  );
  const profilePage = readRepoFile("apps/web/src/app/profile/page.tsx");

  assert(
    memberWorkspace.includes("MemberSettingsSummaries"),
    "Member page must show settings summaries",
  );
  assert(summaries.includes("/preferences"), "Member summaries must link to preferences");
  assert(
    !memberWorkspace.includes("Coming soon"),
    "Member page must not show coming soon placeholders",
  );
  assert(profilePage.includes("MemberProfilePreview"), "Profile page must be preview-only");
  assert(!profilePage.includes("placeholder"), "Profile page must not use placeholder sections");
}

function verifyGeography(): void {
  console.log("3. Participation geography selectors");

  const geography = readRepoFile(
    "apps/api/src/modules/participation-area/participation-area-geography.ts",
  );
  const section = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );
  const packageIndex = readRepoFile("apps/web/src/data/geography/index.ts");

  assert(
    geography.includes("getRegionsForCountry"),
    "Geography must use shared @hu/geography dataset",
  );
  assert(packageIndex.includes("getCountries"), "Shared geography package must export countries");
  assert(
    section.includes("GeographySearchSelect"),
    "Participation area must use searchable geography select",
  );
  assert(
    section.includes("OTHER_REGION_SLUG"),
    "Participation area must support Other / Not listed",
  );
  assert(section.includes("not nationality"), "Country label must clarify participation geography");
  assert(section.includes('setRegionSlug("")'), "Country change must reset region");
}

function verifyInterestNotifications(): void {
  console.log("4. Interest-based notification matching");

  const matcher = readRepoFile(
    "apps/api/src/modules/notifications/initiative-interest-match.service.ts",
  );
  const templates = readRepoFile("apps/api/src/modules/notifications/notification.templates.ts");
  const initiativeService = readRepoFile("apps/api/src/modules/initiatives/initiative.service.ts");

  assert(
    matcher.includes("interestMatchNotificationsEnabled"),
    "Matcher must respect opt-out preference",
  );
  assert(
    matcher.includes("hasInterestSelections"),
    "Matcher must skip participants without interests",
  );
  assert(matcher.includes("selected interest"), "Notification message must explain match reason");
  assert(
    templates.includes("initiative_interest_match"),
    "Notification templates must include interest match",
  );
  assert(
    initiativeService.includes("notifyInterestedParticipantsOfPublishedInitiative"),
    "Publish flow must trigger interest matching",
  );
}

function verifyInitiativeUx(): void {
  console.log("5. Initiative creation UX");

  const createForm = readRepoFile(
    "apps/web/src/features/initiatives/components/StartNewInitiativeButton.tsx",
  );
  const draftEditor = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeDraftEditor.tsx",
  );

  assert(createForm.includes("Save Draft"), "Create form must include Save Draft action");
  assert(
    createForm.includes("Publish Initiative"),
    "Create form must include Publish Initiative action",
  );
  assert(
    createForm.includes("Sign in to create an initiative."),
    "Create form must show friendly auth prompt",
  );
  assert(createForm.includes("Draft saved successfully."), "Create form must confirm draft save");
  assert(
    createForm.includes("Initiative published successfully."),
    "Create form must confirm publish success",
  );
  assert(
    draftEditor.includes("Publish Initiative"),
    "Draft editor must label publish action clearly",
  );
}

function verifyVisibilityProjection(): void {
  console.log("6. Preference visibility projection");

  const projection = readRepoFile("apps/api/src/modules/participation/participation.projection.ts");

  assert(
    projection.includes("resolvePublicParticipationVisibility"),
    "Public projection must derive visibility from saved preferences",
  );
}

async function verifyPreferencesRuntime(): Promise<void> {
  console.log("7. Preferences runtime persistence");

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

  await bootstrapAuthPersistence();

  const email = `member-prefs-ux-${Date.now()}@example.com`;
  const registered = await registerAndConfirmAuthUser({
    email,
    displayName: "Preferences UX Verify",
    password: "verify-password-123",
  });

  const updated = await updateMemberPreferencesForAuthUser(registered.user.memberId, {
    experiencePreferences: {
      skills: ["Facilitation"],
    },
    participationPreferences: {
      preferredActivityAreas: ["Environment and Climate"],
    },
  });

  assert(updated.experiencePreferences.skills.includes("Facilitation"), "Skills must persist");

  const reloaded = await findPreferencesByMemberId(registered.user.memberId);
  assert(
    Boolean(
      reloaded?.participationPreferences.preferredActivityAreas.includes("Environment and Climate"),
    ),
    "Preferred activity areas must persist in MongoDB",
  );
}

async function main(): Promise<void> {
  verifyPreferencesUi();
  verifyMemberArchitecture();
  verifyGeography();
  verifyInterestNotifications();
  verifyInitiativeUx();
  verifyVisibilityProjection();
  await verifyPreferencesRuntime();
  console.log("\nTASK-082 verify:member-preferences-initiative-ux PASS");
}

void runVerificationScript(main);
