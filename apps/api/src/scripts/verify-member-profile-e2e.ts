/**
 * TASK-053 — Member Profile Foundation verification.
 * Run: npm run verify:member-profile
 */

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
import { validateAvatarUrl } from "../modules/member-profile/member-profile.validators.js";
import {
  assertPublicMemberProfileIsSafe,
  toPublicMemberProfile,
} from "../modules/member-profile/member-profile.projection.js";
import {
  deleteMemberProfileByUserId,
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../modules/member-profile/member-profile.repository.js";
import {
  getPublicMemberProfileById,
  getWorkspaceMemberIdentityForUser,
  updateMemberProfileForUser,
  updateMemberProfilePrivacyForUser,
} from "../modules/member-profile/member-profile.service.js";
import { createInitialParticipationAreaForParticipant } from "../modules/participation-area/participation-area.service.js";
import { createInitiativeDraft } from "../modules/initiatives/initiative.service.js";
import { resolveRequestIdentity } from "../modules/initiatives/identity/resolve-request-identity.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TEST_EMAIL_PREFIX = `member-profile-verify-${Date.now()}`;

const FORBIDDEN_PUBLIC_FIELDS = [
  "userId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "refreshToken",
  "memberNumber",
] as const;

function verifyAssert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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

async function verifyRegistrationCreatesProfile(prefix: string): Promise<string> {
  const email = `${prefix}@example.com`;
  const registered = await registerAuthUser({
    email,
    password: "verify-password-123",
    displayName: "Profile Verify User",
  });

  const authUser = await findRawAuthUserByEmail(email);
  verifyAssert(authUser !== null, "Auth user must exist after registration");

  const profile = await findMemberProfileByUserId(authUser!.userId);
  verifyAssert(profile !== null, "Member profile must auto-create after registration");
  verifyAssert(
    profile!.displayName === "Profile Verify User",
    "Profile display name must match registration",
  );
  verifyAssert(!("passwordHash" in profile!), "Profile must not store passwordHash");
  verifyAssert(!("email" in profile!), "Profile must not store email");

  void registered;
  return authUser!.userId;
}

async function verifyProfileUpdate(userId: string, memberId: string): Promise<string> {
  const updated = await updateMemberProfileForUser(userId, {
    biography: "Civic participant biography.",
    avatarUrl: "https://cdn.example.com/avatar.webp",
  });

  verifyAssert(
    updated.biography === "Civic participant biography.",
    "Profile biography must update",
  );

  await createInitialParticipationAreaForParticipant({
    participantId: memberId,
    userId,
    body: {
      countrySlug: "canada",
      regionSlug: "british-columbia",
      communitySlug: "16735",
    },
  });

  const synced = await findMemberProfileByUserId(userId);
  verifyAssert(synced?.country === "Canada", "Profile country must sync from Participation Area");
  verifyAssert(
    synced?.region === "British Columbia",
    "Profile region must sync from Participation Area",
  );
  verifyAssert(
    synced?.community === "Nelson",
    "Profile community must sync from Participation Area",
  );

  return updated.profileId;
}

async function verifyPrivacySettings(userId: string, profileId: string): Promise<void> {
  await updateMemberProfilePrivacyForUser(userId, {
    profileVisibility: "public",
    showOrganization: false,
    showLocation: true,
    showParticipationArea: false,
    participationVisibility: "private",
  });

  const publicProfile = await getPublicMemberProfileById(profileId, {
    viewerIsAuthenticated: false,
    viewerUserId: undefined,
  });

  verifyAssert(publicProfile.profileId === profileId, "Public profile must resolve by profileId");
  verifyAssert(
    publicProfile.membershipStatus === "participant",
    "Default public membership status must be participant",
  );
  verifyAssert(
    publicProfile.memberBadgeVisible === false,
    "Default public member badge visibility must be false",
  );
  verifyAssert(publicProfile.country === "Canada", "Public profile may expose allowed location");
  verifyAssert(
    publicProfile.organization === undefined,
    "Hidden organization must not appear publicly",
  );

  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (field === "memberNumber") {
      continue;
    }

    verifyAssert(!(field in publicProfile), `Public projection must not expose ${field}`);
  }

  verifyAssert(
    !("memberNumber" in publicProfile),
    "Membership member number must remain hidden by default",
  );

  assertPublicMemberProfileIsSafe(publicProfile as unknown as Record<string, unknown>);

  await updateMemberProfilePrivacyForUser(userId, {
    profileVisibility: "private",
  });

  await expectAccessDenied(() =>
    getPublicMemberProfileById(profileId, {
      viewerIsAuthenticated: true,
      viewerUserId: "other-user",
    }),
  );
}

async function expectAccessDenied(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    throw new Error("Expected access denied.");
  } catch (error) {
    verifyAssert(
      error instanceof Error && /not accessible|not found/i.test(error.message),
      `Expected access denied but got ${String(error)}`,
    );
  }
}

async function verifyWorkspaceIdentity(userId: string): Promise<void> {
  const identity = await getWorkspaceMemberIdentityForUser(userId);
  verifyAssert(identity.displayName.length > 0, "Workspace identity must include display name");
  verifyAssert(identity.avatarUrl.length > 0, "Workspace identity must include avatar URL");
}

function verifyAvatarValidation(): void {
  verifyAssert(
    validateAvatarUrl("https://cdn.example.com/images/photo.png") ===
      "https://cdn.example.com/images/photo.png",
    "Valid PNG avatar URL must pass",
  );

  try {
    validateAvatarUrl("https://cdn.example.com/file.gif");
    throw new Error("GIF avatar must fail.");
  } catch (error) {
    verifyAssert(
      error instanceof Error && /PNG, JPG, or WEBP/i.test(error.message),
      "Invalid avatar extension must be rejected",
    );
  }
}

async function verifyCapability02Compatibility(userId: string): Promise<void> {
  const profile = await findMemberProfileByUserId(userId);
  verifyAssert(profile !== null, "Profile required for compatibility check");

  const identity = await resolveRequestIdentity({
    auth: {
      id: userId,
      email: "verify@example.com",
      provider: "email",
      status: "active",
      roles: ["member"],
      memberId: profile!.profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  } as never);

  const initiative = createInitiativeDraft(identity, {
    title: "Member Profile Verify Initiative",
    description: "Ensures member profile foundation does not break civic draft creation.",
    communitySlug: "nelson-community-garden",
    activityArea: "infrastructure",
  });

  verifyAssert(
    initiative.initiativeId.length > 0,
    "Capability 02 draft creation must remain compatible",
  );
}

async function verifyVisibilityRules(userId: string): Promise<void> {
  await updateMemberProfilePrivacyForUser(userId, {
    profileVisibility: "members_only",
  });

  const profile = await findMemberProfileByUserId(userId);
  verifyAssert(profile !== null, "Profile required for visibility checks");

  const anonymousView = toPublicMemberProfile(profile!, {
    viewerIsAuthenticated: false,
    viewerIsOwner: false,
  });

  verifyAssert(anonymousView === null, "members_only profile must hide from anonymous viewers");

  const memberView = toPublicMemberProfile(profile!, {
    viewerIsAuthenticated: true,
    viewerIsOwner: false,
  });

  verifyAssert(memberView !== null, "members_only profile must show to authenticated viewers");
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:member-profile pass ${pass} ===`);

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for verify:member-profile.");
  }

  await bootstrapAuthPersistence();

  const prefix = `${TEST_EMAIL_PREFIX}-p${pass}`;
  await cleanup(prefix);

  verifyAvatarValidation();
  const userId = await verifyRegistrationCreatesProfile(prefix);
  const authUser = await findRawAuthUserByEmail(`${prefix}@example.com`);
  verifyAssert(authUser !== null, "Auth user required for profile update verification");
  const profileId = await verifyProfileUpdate(userId, authUser!.memberId);
  await verifyPrivacySettings(userId, profileId);
  await verifyVisibilityRules(userId);
  await verifyWorkspaceIdentity(userId);
  await verifyCapability02Compatibility(userId);

  await cleanup(prefix);
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:member-profile PASSED (3 consecutive passes).");
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
