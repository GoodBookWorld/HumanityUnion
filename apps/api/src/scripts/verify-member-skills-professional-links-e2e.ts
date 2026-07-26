/**
 * TASK-099 — Member Skills & Professional Links verification.
 * Run: npm run verify:member-skills-professional-links
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { registerAuthUser } from "../modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import { toPublicMemberProfile } from "../modules/member-profile/member-profile.projection.js";
import {
  deleteMemberProfileByUserId,
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../modules/member-profile/member-profile.repository.js";
import {
  getPublicMemberProfileById,
  updateMemberProfileForUser,
  updateMemberProfilePrivacyForUser,
} from "../modules/member-profile/member-profile.service.js";
import {
  validateLinkedInUrl,
  validateSkills,
  validateWebsiteUrl,
} from "../modules/member-profile/member-profile.validators.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, "../../../..");

dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TEST_EMAIL_PREFIX = `member-skills-links-verify-${Date.now()}`;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function cleanup(prefix: string): Promise<void> {
  const authUser = await findRawAuthUserByEmail(`${prefix}@example.com`);
  if (authUser) {
    await deleteAuthSessionsByUserIds([authUser.userId]);
    await deleteMemberProfileByUserId(authUser.userId);
    await deleteAuthUsersByEmailPrefix(prefix);
    return;
  }

  await deleteMemberProfilesByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

function verifyStaticStructure(): void {
  console.log("1. Static structure and UI separation");

  const profileTypes = readRepoFile("packages/types/src/domain/member-profile.ts");
  const workspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const summaries = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberSettingsSummaries.tsx",
  );
  const preview = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfilePreview.tsx",
  );
  const validators = readRepoFile(
    "apps/api/src/modules/member-profile/member-profile.validators.ts",
  );
  const projection = readRepoFile(
    "apps/api/src/modules/member-profile/member-profile.projection.ts",
  );

  assert(profileTypes.includes("skills: string[]"), "MemberProfile must include skills array.");
  assert(profileTypes.includes("skillsVisibility"), "MemberProfile must include skillsVisibility.");
  assert(
    profileTypes.includes("professionalLinksVisibility"),
    "MemberProfile must include professionalLinksVisibility.",
  );
  assert(validators.includes("validateSkills"), "Validators must include validateSkills.");
  assert(workspace.includes("MemberSkillsEditor"), "Workspace must include skills editor.");
  assert(
    workspace.includes('title="Professional Links"'),
    "Workspace must include Professional Links section.",
  );
  assert(
    !summaries.includes("Skills & Interests"),
    "Summaries must not merge skills with professional links.",
  );
  assert(
    summaries.includes('title="Professional Links"'),
    "Summaries must show Professional Links.",
  );
  assert(summaries.includes('title="Skills"'), "Summaries must show profile skills separately.");
  assert(
    !summaries.includes("preferences.experiencePreferences.skills"),
    "Summaries must not treat preference skills as profile skills.",
  );
  assert(preview.includes("Professional Links"), "Profile preview must show Professional Links.");
  assert(
    projection.includes("professionalLinksVisible"),
    "Projection must gate professional links by visibility.",
  );
  assert(projection.includes("skillsVisible"), "Projection must gate skills by visibility.");
}

function verifySkillValidation(): void {
  console.log("2. Skill validation rules");

  const normalized = validateSkills(["  Facilitation  ", "facilitation", "Policy Design", ""]);
  assert(normalized.length === 2, "Skills must trim and dedupe case-insensitively.");
  assert(normalized[0] === "Facilitation", "First skill casing must be preserved.");
  assert(normalized[1] === "Policy Design", "Distinct skills must remain.");

  try {
    validateSkills(Array.from({ length: 26 }, (_, index) => `Skill ${index + 1}`));
    throw new Error("Expected skill count limit failure.");
  } catch (error) {
    assert(
      error instanceof Error && /at most 25/i.test(error.message),
      "Skill count limit must be enforced.",
    );
  }

  try {
    validateSkills(["x".repeat(49)]);
    throw new Error("Expected skill label length failure.");
  } catch (error) {
    assert(
      error instanceof Error && /at most 48/i.test(error.message),
      "Skill label length must be enforced.",
    );
  }
}

function verifySafeUrls(): void {
  console.log("3. Safe professional link URLs");

  assert(
    validateWebsiteUrl("https://example.com") === "https://example.com",
    "Valid website URL must pass.",
  );
  assert(
    validateLinkedInUrl("https://www.linkedin.com/in/example") ===
      "https://www.linkedin.com/in/example",
    "Valid LinkedIn URL must pass.",
  );

  try {
    validateWebsiteUrl("javascript:alert(1)");
    throw new Error("Expected unsafe website URL failure.");
  } catch (error) {
    assert(
      error instanceof Error && /http or https/i.test(error.message),
      "Unsafe website protocol must be rejected.",
    );
  }

  try {
    validateLinkedInUrl("https://evil.example/linkedin");
    throw new Error("Expected non-LinkedIn host failure.");
  } catch (error) {
    assert(
      error instanceof Error && /linkedin.com/i.test(error.message),
      "LinkedIn host prefix must be enforced.",
    );
  }
}

function verifyNoLinkedInScraping(): void {
  console.log("4. No LinkedIn scraping or skill inference");

  const apiModules = readRepoFile("apps/api/src/modules/member-profile/member-profile.service.ts");
  const workspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );

  assert(!apiModules.includes("scrape"), "Member profile service must not scrape LinkedIn.");
  assert(!workspace.includes("scrape"), "Member profile workspace must not scrape LinkedIn.");
  assert(
    !workspace.includes("infer"),
    "Member profile workspace must not infer skills from links.",
  );
}

async function verifyPersistenceAndPrivacy(prefix: string): Promise<void> {
  console.log("5. Persistence, separation, and privacy");

  const email = `${prefix}@example.com`;
  await registerAuthUser({
    email,
    password: "verify-password-123",
    displayName: "Skills Links Verify User",
  });

  const authUser = await findRawAuthUserByEmail(email);
  assert(authUser !== null, "Auth user must exist after registration.");

  const userId = authUser!.userId;
  const profileBefore = await findMemberProfileByUserId(userId);
  assert(profileBefore !== null, "Member profile must exist after registration.");
  assert(Array.isArray(profileBefore!.skills), "Default profile must include skills array.");

  const updated = await updateMemberProfileForUser(userId, {
    skills: ["Facilitation", "Policy Design"],
    website: "https://example.org",
    linkedinUrl: "https://www.linkedin.com/in/skills-verify",
  });

  assert(updated.skills.length === 2, "Skills must persist on MemberProfile.");
  assert(updated.website === "https://example.org", "Website must persist separately.");
  assert(
    updated.linkedinUrl === "https://www.linkedin.com/in/skills-verify",
    "LinkedIn must persist separately.",
  );
  assert(!updated.skills.includes("https://example.org"), "Website must not appear in skills.");

  await updateMemberProfilePrivacyForUser(userId, {
    profileVisibility: "public",
    skillsVisibility: "private",
    professionalLinksVisibility: "private",
  });

  const hiddenPublic = await getPublicMemberProfileById(updated.profileId, {
    viewerIsAuthenticated: false,
    viewerUserId: undefined,
  });

  assert(hiddenPublic.skills === undefined, "Private skills must not appear publicly.");
  assert(hiddenPublic.website === undefined, "Private website must not appear publicly.");
  assert(hiddenPublic.linkedinUrl === undefined, "Private LinkedIn must not appear publicly.");

  await updateMemberProfilePrivacyForUser(userId, {
    skillsVisibility: "public",
    professionalLinksVisibility: "public",
  });

  const visiblePublic = await getPublicMemberProfileById(updated.profileId, {
    viewerIsAuthenticated: false,
    viewerUserId: undefined,
  });

  assert(Array.isArray(visiblePublic.skills), "Public skills must be exposed when allowed.");
  assert(visiblePublic.skills?.includes("Facilitation"), "Public skills must include saved tags.");
  assert(visiblePublic.website === "https://example.org", "Public website must be exposed.");
  assert(
    visiblePublic.linkedinUrl === "https://www.linkedin.com/in/skills-verify",
    "Public LinkedIn must be exposed.",
  );

  const profile = await findMemberProfileByUserId(userId);
  assert(profile !== null, "Profile required for projection checks.");

  const memberOnlySkills = toPublicMemberProfile(
    {
      ...profile!,
      skillsVisibility: "members_only",
      professionalLinksVisibility: "members_only",
    },
    {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    },
  );

  assert(
    memberOnlySkills?.skills === undefined,
    "members_only skills must hide from anonymous viewers.",
  );
  assert(
    memberOnlySkills?.website === undefined,
    "members_only professional links must hide from anonymous viewers.",
  );
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:member-skills-professional-links pass ${pass} ===`);

  verifyStaticStructure();
  verifySkillValidation();
  verifySafeUrls();
  verifyNoLinkedInScraping();

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for persistence verification.");
  }

  await bootstrapAuthPersistence();

  const prefix = `${TEST_EMAIL_PREFIX}-p${pass}`;
  await cleanup(prefix);
  await verifyPersistenceAndPrivacy(prefix);
  await cleanup(prefix);

  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:member-skills-professional-links PASSED (3 consecutive passes).");
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (isMongoConfigured()) {
      await disconnectMongoClient().catch(() => undefined);
    }
  });
