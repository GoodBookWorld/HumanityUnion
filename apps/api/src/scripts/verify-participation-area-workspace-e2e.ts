/**
 * TASK-054 — Participation Area Workspace verification.
 * Run: npm run verify:participation-area-workspace
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import type { Request } from "express";
import { getTransparencyCohort, participationAreaSlugTriple } from "@hu/types";

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { authenticationMiddleware } from "../modules/auth/auth.middleware.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import { registerAndConfirmAuthUser } from "../modules/auth/auth.service.js";
import { resolveRequestIdentity } from "../modules/initiatives/identity/resolve-request-identity.js";
import {
  deleteMemberProfileByUserId,
  deleteMemberProfilesByUserIdPrefix,
  findMemberProfileByUserId,
} from "../modules/member-profile/member-profile.repository.js";
import {
  getPublicMemberProfileById,
  updateMemberProfilePrivacyForUser,
} from "../modules/member-profile/member-profile.service.js";
import { evaluateStoredDecisionParticipationEligibility } from "../modules/participation-eligibility/participation-eligibility.service.js";
import {
  cancelParticipationAreaChangeForParticipant,
  createInitialParticipationAreaForParticipant,
  loadParticipationAreaWorkspaceForParticipant,
  requestParticipationAreaChangeForParticipant,
} from "../modules/participation-area/participation-area.service.js";
import {
  getActiveParticipationAreaForParticipant,
  getPendingParticipationAreaTransitionForParticipant,
  resolveActiveParticipationArea,
  seedParticipationAreaTransition,
} from "../modules/participation-area/participation-area.store.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, "../../../..");

dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TEST_EMAIL_PREFIX = `participation-area-workspace-${Date.now()}`;

const FORBIDDEN_CODE_TERMS = [
  "ipAddress",
  "ip_address",
  "geolocation",
  "geoLocation",
  "latitude",
  "longitude",
  "deviceFingerprint",
  "networkLocation",
  "voteWeight",
  "vote_weight",
] as const;

const API_SCANNED_FILES = [
  "apps/api/src/modules/participation-area/participation-area.routes.ts",
  "apps/api/src/modules/participation-area/participation-area.service.ts",
  "apps/api/src/modules/participation-area/participation-area.validators.ts",
  "apps/api/src/modules/participation-area/participation-area-geography.ts",
  "apps/web/src/features/participation-area/participation-area-api.ts",
] as const;

function verifyAssert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function pastIsoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
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

async function registerParticipant(prefix: string): Promise<{
  userId: string;
  memberId: string;
  accessToken: string;
}> {
  const email = `${prefix}@example.com`;
  const password = "verify-password-123";

  const session = await registerAndConfirmAuthUser({
    email,
    password,
    displayName: "Participation Area Verify User",
  });

  const authUser = await findRawAuthUserByEmail(email);
  verifyAssert(authUser !== null, "Auth user must exist after registration");

  return {
    userId: authUser!.userId,
    memberId: authUser!.memberId,
    accessToken: session.tokens.accessToken,
  };
}

async function verifyCreateInitialArea(input: { userId: string; memberId: string }): Promise<void> {
  console.log("1. Create initial Participation Area");

  const state = await createInitialParticipationAreaForParticipant({
    participantId: input.memberId,
    userId: input.userId,
    body: {
      countrySlug: "canada",
      regionSlug: "british-columbia",
      communitySlug: "16735",
    },
  });

  verifyAssert(state.activeArea !== null, "Active area must exist after create");
  verifyAssert(state.activeArea!.countrySlug === "ca", "Active country slug must match");
  verifyAssert(state.activeArea!.communitySlug === "16735", "Active community slug must normalize");
  verifyAssert(state.labels.country === "Canada", "Active country label must resolve");
  verifyAssert(
    state.activeArea!.verificationStatus === "unverified",
    "Initial verification status must be unverified",
  );

  const profile = await findMemberProfileByUserId(input.userId);
  verifyAssert(
    profile?.participationAreaId === state.activeArea!.participationAreaId,
    "Profile must sync participationAreaId",
  );
  verifyAssert(profile?.country === "Canada", "Profile country must sync from active area");
}

async function verifyParticipantIdCannotBeSpoofed(input: {
  userId: string;
  memberId: string;
  accessToken: string;
}): Promise<void> {
  console.log("2. participantId cannot be spoofed from request body");

  const req = {
    headers: {
      authorization: `Bearer ${input.accessToken}`,
    },
    body: {
      participantId: "spoofed-participant-id",
      countrySlug: "canada",
    },
  } as Request;

  let nextCalled = false;

  authenticationMiddleware(req, { status: () => ({ json: () => undefined }) } as never, () => {
    nextCalled = true;
  });

  verifyAssert(nextCalled, "Authentication middleware must call next()");
  const identity = await resolveRequestIdentity(req);
  verifyAssert(
    identity.participantId === input.memberId,
    "participantId must come from JWT memberId",
  );
  verifyAssert(
    identity.participantId !== "spoofed-participant-id",
    "Request body participantId must be ignored",
  );
}

async function verifyPendingTransitionDoesNotAffectEligibility(input: {
  memberId: string;
  userId: string;
}): Promise<void> {
  console.log("3. Pending transition must not affect eligibility before effectiveAt");

  await requestParticipationAreaChangeForParticipant({
    participantId: input.memberId,
    userId: input.userId,
    body: {
      countrySlug: "canada",
      regionSlug: "british-columbia",
      communitySlug: "17145",
    },
  });

  const pending = getPendingParticipationAreaTransitionForParticipant(input.memberId);
  verifyAssert(pending !== null, "Pending transition must exist");
  verifyAssert(
    Date.parse(pending!.effectiveAt) > Date.now(),
    "Pending transition effectiveAt must be in the future",
  );

  const activeArea = getActiveParticipationAreaForParticipant(input.memberId);
  verifyAssert(
    activeArea?.communitySlug === "16735",
    "Active area must remain unchanged while transition is pending",
  );

  const nelsonEligible = evaluateStoredDecisionParticipationEligibility({
    participantId: input.memberId,
    isRegistered: true,
    participantStatus: "active",
    decisionParticipationScope: "community",
    initiativeCommunitySlug: "16735",
    decisionStatus: "opened",
    openedAt: pastIsoDate(1),
    closesAt: futureIsoDate(14),
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });

  verifyAssert(nelsonEligible.eligible, "Active area must remain eligible for current community");

  const kootenayIneligible = evaluateStoredDecisionParticipationEligibility({
    participantId: input.memberId,
    isRegistered: true,
    participantStatus: "active",
    decisionParticipationScope: "community",
    initiativeCommunitySlug: "17145",
    decisionStatus: "opened",
    openedAt: pastIsoDate(1),
    closesAt: futureIsoDate(14),
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });

  verifyAssert(
    !kootenayIneligible.eligible,
    "Pending destination must not affect eligibility before effectiveAt",
  );
}

async function verifyCancelPendingTransition(input: {
  memberId: string;
  userId: string;
}): Promise<void> {
  console.log("4. Cancel pending transition");

  const cancelled = await cancelParticipationAreaChangeForParticipant({
    participantId: input.memberId,
    userId: input.userId,
  });

  verifyAssert(
    cancelled.pendingTransition === null,
    "Pending transition must be cleared after cancel",
  );
  verifyAssert(
    getPendingParticipationAreaTransitionForParticipant(input.memberId) === null,
    "Store must not retain pending transition after cancel",
  );
}

async function verifyResolveDueTransition(input: {
  memberId: string;
  userId: string;
}): Promise<void> {
  console.log("5. Resolve due transition into active area");

  const activeBefore = getActiveParticipationAreaForParticipant(input.memberId);
  verifyAssert(activeBefore !== null, "Active area required before transition resolve test");

  seedParticipationAreaTransition({
    transitionId: `verify-transition-${Date.now()}`,
    participantId: input.memberId,
    fromArea: participationAreaSlugTriple(
      activeBefore!.countrySlug,
      activeBefore!.regionSlug,
      activeBefore!.communitySlug,
    ),
    toArea: participationAreaSlugTriple("ca", "CA-BC", "17145"),
    requestedAt: pastIsoDate(20),
    effectiveAt: pastIsoDate(1),
    status: "pending",
  });

  const resolved = await loadParticipationAreaWorkspaceForParticipant({
    participantId: input.memberId,
    userId: input.userId,
  });

  verifyAssert(
    resolved.activeArea?.communitySlug === "17145",
    "Due transition must resolve into new active area",
  );
  verifyAssert(
    resolved.pendingTransition === null,
    "Resolved transition must no longer be pending",
  );

  const profile = await findMemberProfileByUserId(input.userId);
  verifyAssert(
    profile?.community === "Vancouver",
    "Member profile display must sync after transition resolves",
  );
}

async function verifyVerificationStatusTransparencyOnly(input: {
  memberId: string;
}): Promise<void> {
  console.log("6. Verification status remains transparency-only");

  const activeArea = resolveActiveParticipationArea(input.memberId, new Date().toISOString());
  verifyAssert(activeArea !== null, "Active area required for verification status check");

  const cohort = getTransparencyCohort(activeArea!.verificationStatus);
  verifyAssert(typeof cohort === "string", "Transparency cohort must be informational only");
  verifyAssert(
    activeArea!.verificationStatus === "unverified",
    "Workspace create keeps unverified status",
  );
}

async function verifyPublicPrivacyRespected(userId: string, profileId: string): Promise<void> {
  console.log("7. Public privacy respected");

  await updateMemberProfilePrivacyForUser(userId, {
    profileVisibility: "public",
    showParticipationArea: false,
    participationVisibility: "private",
    showLocation: false,
  });

  const publicProfile = await getPublicMemberProfileById(profileId, {
    viewerIsAuthenticated: false,
    viewerUserId: undefined,
  });

  verifyAssert(
    publicProfile.participationAreaId === undefined,
    "Participation area must not appear publicly when privacy disallows it",
  );
  verifyAssert(
    publicProfile.country === undefined,
    "Location must not appear when showLocation is false",
  );
}

async function verifyNoForbiddenTrackingTerms(): Promise<void> {
  console.log("8. No IP/VPN/geolocation/vote-weight fields");

  for (const relativePath of API_SCANNED_FILES) {
    const content = readRepoFile(relativePath);

    for (const term of FORBIDDEN_CODE_TERMS) {
      verifyAssert(!content.includes(term), `${relativePath} must not include ${term}`);
    }
  }

  const section = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );
  verifyAssert(
    /VPN signals|IP address|geolocation/i.test(section),
    "Participation Area UI must explain that VPN/IP/geolocation are not used",
  );
}

function verifyMemberWorkspaceUi(): void {
  console.log("9. /member renders Participation Area section");

  const memberPage = readRepoFile("apps/web/src/app/member/page.tsx");
  const workspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const section = readRepoFile(
    "apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx",
  );

  verifyAssert(
    memberPage.includes("MemberProfileWorkspace"),
    "/member must render member workspace",
  );
  verifyAssert(
    workspace.includes("ParticipationAreaSection"),
    "Member workspace must include Participation Area section",
  );
  verifyAssert(
    section.includes("Current Participation Area"),
    "Participation Area section must show current area card",
  );
  verifyAssert(
    section.includes("Pending Change"),
    "Participation Area section must show pending change card",
  );
  verifyAssert(
    section.includes("How this affects voting"),
    "Participation Area section must include explanation card",
  );
}

async function verifyProfileDoesNotAcceptDirectLocationPatch(userId: string): Promise<void> {
  console.log("10. Member profile PATCH does not accept direct location fields");

  try {
    await import("../modules/member-profile/member-profile.service.js").then(
      ({ updateMemberProfileForUser }) =>
        updateMemberProfileForUser(userId, {
          country: "Mexico",
        }),
    );
    throw new Error("Direct country patch should fail.");
  } catch (error) {
    verifyAssert(
      error instanceof Error && /No valid profile fields/i.test(error.message),
      "Direct location patch must be rejected",
    );
  }
}

async function runVerificationPass(pass: number): Promise<void> {
  console.log(`\n=== verify:participation-area-workspace pass ${pass} ===`);

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for verify:participation-area-workspace.");
  }

  await bootstrapAuthPersistence();

  const prefix = `${TEST_EMAIL_PREFIX}-p${pass}`;
  await cleanup(prefix);

  verifyNoForbiddenTrackingTerms();
  verifyMemberWorkspaceUi();

  const participant = await registerParticipant(prefix);
  await verifyCreateInitialArea(participant);
  await verifyParticipantIdCannotBeSpoofed(participant);
  await verifyPendingTransitionDoesNotAffectEligibility(participant);
  await verifyCancelPendingTransition(participant);
  await verifyResolveDueTransition(participant);
  await verifyVerificationStatusTransparencyOnly(participant);
  await verifyPublicPrivacyRespected(
    participant.userId,
    (await findMemberProfileByUserId(participant.userId))!.profileId,
  );
  await verifyProfileDoesNotAcceptDirectLocationPatch(participant.userId);

  await cleanup(prefix);
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= 3; pass += 1) {
    await runVerificationPass(pass);
  }

  console.log("\nverify:participation-area-workspace PASSED (3 consecutive passes).");
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
