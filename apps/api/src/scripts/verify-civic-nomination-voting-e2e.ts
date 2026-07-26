/**
 * TASK-075 — Civic Nomination Voting Foundation verification.
 * Run: npm run verify:civic-nomination-voting
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import type { Member } from "@hu/types";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const MODULE_DIR = path.join(REPO_ROOT, "apps/api/src/modules/civic-nomination-vote");

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const TEST_PREFIX = `civic-nomination-voting-verify-${Date.now()}`;

const verifiedCanadaVoter: RequestIdentity = {
  participantId: "member-cn-vote-verified-ca",
  displayName: "Verified Canada Voter",
};

const unverifiedCanadaVoter: RequestIdentity = {
  participantId: "member-cn-vote-unverified-ca",
  displayName: "Unverified Canada Voter",
};

const ineligibleMexicoVoter: RequestIdentity = {
  participantId: "member-cn-vote-ineligible-mx",
  displayName: "Ineligible Mexico Voter",
};

const worldVoter: RequestIdentity = {
  participantId: "member-cn-vote-world",
  displayName: "World Scope Voter",
};

const adminIdentity: RequestIdentity = {
  participantId: "member-admin-cn-vote",
  role: "admin",
  displayName: "Institution Moderator",
};

const FORBIDDEN_PUBLIC_FIELDS = [
  "participantId",
  "profileId",
  "userId",
  "email",
  "appointment",
  "hire",
  "office",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertThrowsAsync(fn: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function createTestMember(id: string, displayName: string): Member {
  return {
    id,
    profile: {
      displayName,
      uniqueName: id.replace("member-", ""),
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sampleNominationInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    institutionRole: "humanity_council",
    nominationType: "self",
    nomineeName: "Jordan Example",
    countrySlug: "canada",
    expertiseAreas: ["law", "human_rights"],
    experienceSummary: "Public interest law and civic accountability experience.",
    confirmedAchievements: "Led a verified public service review panel.",
    evidenceLinks: [
      {
        title: "Public service review",
        url: "https://example.com/public-service-review",
        evidenceType: "public_service",
      },
    ],
    visionStatement: "Strengthen transparent deliberation and responsible coordination.",
    conflictOfInterest: { status: "none_known" },
    declarations: {
      supportsUdhr: true,
      supportsHumanityUnionPrinciples: true,
      understandsNoAutomaticAppointment: true,
      confirmsAccuracy: true,
    },
    ...overrides,
  };
}

function verifyModuleStructure(): void {
  console.log("1. Module structure and routes");

  for (const file of [
    "civic-nomination-vote.service.ts",
    "civic-nomination-vote.store.ts",
    "civic-nomination-vote-eligibility.ts",
    "civic-nomination-vote-aggregates.ts",
    "civic-nomination-vote.projection.ts",
    "civic-nomination-voting-session.service.ts",
    "civic-nomination-vote.routes.ts",
    "persistence/civic-nomination-vote-mongo.persistence.ts",
  ]) {
    assert(
      fs.existsSync(path.join(MODULE_DIR, file)),
      `Missing civic nomination vote file: ${file}`,
    );
  }

  const domainSource = readRepoFile("packages/types/src/domain/civic-nomination-voting.ts");
  assert(domainSource.includes("CivicNominationVote"), "Domain must define CivicNominationVote");
  assert(domainSource.includes("CivicNominationVotingResult"), "Domain must define voting result");

  const civicNominationRoutes = readRepoFile(
    "apps/api/src/modules/civic-nomination/civic-nomination.routes.ts",
  );
  assert(
    civicNominationRoutes.includes("registerCivicNominationVoteRoutes"),
    "Civic nomination router must register vote routes",
  );

  const publicRoutes = readRepoFile(
    "apps/api/src/modules/civic-nomination/public-civic-nomination.routes.ts",
  );
  assert(
    publicRoutes.includes("/:nominationId/voting"),
    "Public router must expose voting projection",
  );

  const nominationDomain = readRepoFile("packages/types/src/domain/civic-nomination.ts");
  assert(
    !nominationDomain.includes("supportVotes"),
    "CivicNomination aggregate must not store vote counts",
  );
}

async function seedVoters(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");

  for (const identity of [
    verifiedCanadaVoter,
    unverifiedCanadaVoter,
    ineligibleMexicoVoter,
    worldVoter,
  ]) {
    seedMember(createTestMember(identity.participantId, identity.displayName ?? "Voter"));
  }

  createParticipationArea({
    participantId: verifiedCanadaVoter.participantId,
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
    verificationStatus: "verified",
  });

  createParticipationArea({
    participantId: unverifiedCanadaVoter.participantId,
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
    verificationStatus: "unverified",
  });

  createParticipationArea({
    participantId: ineligibleMexicoVoter.participantId,
    countrySlug: "mexico",
    regionSlug: "jalisco",
    communitySlug: "guadalajara-centro",
    verificationStatus: "verified",
  });

  createParticipationArea({
    participantId: worldVoter.participantId,
    countrySlug: "france",
    regionSlug: "ile-de-france",
    communitySlug: "paris-centre",
    verificationStatus: "verified",
  });
}

async function verifyRuntimeBehavior(): Promise<void> {
  console.log("2. Vote cast, update, eligibility, aggregates, and public projection");

  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { deleteAuthUsersByEmailPrefix } = await import("../modules/auth/auth-user.repository.js");
  const { deleteMemberProfilesByUserIdPrefix } =
    await import("../modules/member-profile/member-profile.repository.js");
  const { registerMemoryNotificationRecipient, clearMemoryNotificationRecipientsForTests } =
    await import("../modules/notifications/notification.recipients.js");
  const { listMyNotifications, drainCivicNotificationEventsForTests } =
    await import("../modules/notifications/notification.service.js");
  const {
    createCivicNominationDraft,
    publishCivicNomination,
    resolveCivicNominationAuthContext,
    resetCivicNominationStoreForTests,
    submitCivicNomination,
  } = await import("../modules/civic-nomination/index.js");
  const {
    castOrUpdateCivicNominationVote,
    getMyCivicNominationVote,
    getPublicCivicNominationVotingProjection,
    openCivicNominationVoting,
    closeCivicNominationVoting,
    resetCivicNominationVoteStoreForTests,
    listVoteHistoryForNomination,
    listVotesForNomination,
    computeCivicNominationVotingResult,
    buildCivicNominationVotingAssistantGuidance,
  } = await import("../modules/civic-nomination-vote/index.js");
  const { getCivicNominationById } =
    await import("../modules/civic-nomination/civic-nomination.store.js");

  resetCivicNominationStoreForTests();
  resetCivicNominationVoteStoreForTests();
  clearMemoryNotificationRecipientsForTests();
  await seedVoters();

  const nominatorEmail = `${TEST_PREFIX}-nominator@example.com`;
  const nominatorRegistration = await registerAndConfirmAuthUser({
    email: nominatorEmail,
    password: "verify-password-123",
    displayName: "Nomination Nominator",
  });
  const nominatorAuth = await resolveCivicNominationAuthContext(nominatorRegistration.user.userId);

  registerMemoryNotificationRecipient({
    memberId: nominatorAuth.memberId,
    userId: nominatorAuth.userId,
    profileId: nominatorAuth.profileId,
  });

  const countryDraft = createCivicNominationDraft(nominatorAuth, sampleNominationInput());
  submitCivicNomination(countryDraft.nominationId, nominatorAuth);
  const countryPublished = await publishCivicNomination(countryDraft.nominationId, adminIdentity);
  assert(countryPublished.status === "published", "Country nomination must be published");

  const worldDraft = createCivicNominationDraft(
    nominatorAuth,
    sampleNominationInput({
      institutionRole: "chamber_of_intellectual_analysis",
      nomineeName: "Alex Analyst",
      countrySlug: undefined,
    }),
  );
  submitCivicNomination(worldDraft.nominationId, nominatorAuth);
  const worldPublished = await publishCivicNomination(worldDraft.nominationId, adminIdentity);

  await openCivicNominationVoting(countryDraft.nominationId, adminIdentity, futureIsoDate(14));
  await openCivicNominationVoting(worldPublished.nominationId, adminIdentity, futureIsoDate(14));

  await assertThrowsAsync(
    () =>
      castOrUpdateCivicNominationVote(ineligibleMexicoVoter, countryDraft.nominationId, {
        choice: "support",
      }),
    "country mismatch must reject vote",
  );

  const supportVote = await castOrUpdateCivicNominationVote(
    verifiedCanadaVoter,
    countryDraft.nominationId,
    { choice: "support" },
  );
  assert(supportVote.choice === "support", "Initial vote should be support");
  assert(supportVote.version === 1, "Initial vote version should be 1");
  assert(supportVote.transparencyCohort === "verified", "Verified cohort stored");

  const updatedVote = await castOrUpdateCivicNominationVote(
    verifiedCanadaVoter,
    countryDraft.nominationId,
    { choice: "do_not_support" },
  );
  assert(updatedVote.voteId === supportVote.voteId, "Vote update must reuse voteId");
  assert(updatedVote.version === 2, "Vote version must increment");

  const unverifiedVote = await castOrUpdateCivicNominationVote(
    unverifiedCanadaVoter,
    countryDraft.nominationId,
    { choice: "support" },
  );
  assert(unverifiedVote.transparencyCohort === "unverified", "Unverified cohort stored");

  assert(
    listVotesForNomination(countryDraft.nominationId).length === 2,
    "Country nomination must have two active votes",
  );
  assert(
    listVoteHistoryForNomination(countryDraft.nominationId).length >= 3,
    "Vote history must be preserved",
  );

  const worldVote = await castOrUpdateCivicNominationVote(worldVoter, worldPublished.nominationId, {
    choice: "abstain",
  });
  assert(worldVote.choice === "abstain", "World scope voter must cast abstain");

  const result = computeCivicNominationVotingResult(countryDraft.nominationId, "open");
  assert(result.totalVotes === 2, "Aggregate totalVotes must match active votes");
  assert(result.supportVotes === 1, "Aggregate supportVotes must count unverified support");
  assert(result.doNotSupportVotes === 1, "Aggregate doNotSupportVotes must count verified oppose");
  assert(result.verifiedVotes === 1, "Verified vote total must be 1");
  assert(result.unverifiedVotes === 1, "Unverified vote total must be 1");
  assert(result.verifiedDoNotSupportVotes === 1, "Verified do-not-support split required");
  assert(result.unverifiedSupportVotes === 1, "Unverified support split required");
  assert(!("appointment" in result), "Result must not include appointment");

  const publicProjection = getPublicCivicNominationVotingProjection(countryDraft.nominationId);
  assert(publicProjection !== null, "Public voting projection must exist for published nomination");
  assert(publicProjection.status === "open", "Public projection must expose open status");
  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    assert(
      !(field in (publicProjection as unknown as Record<string, unknown>)),
      `Public projection must not expose ${field}`,
    );
  }
  assert(
    !JSON.stringify(publicProjection).includes(verifiedCanadaVoter.participantId),
    "Public projection must not expose voter participantId",
  );

  const myVote = getMyCivicNominationVote(verifiedCanadaVoter, countryDraft.nominationId);
  assert(myVote?.choice === "do_not_support", "My vote endpoint must return current vote");

  const nomination = getCivicNominationById(countryDraft.nominationId);
  assert(nomination !== null, "Nomination must exist for assistant guidance");
  const guidance = await buildCivicNominationVotingAssistantGuidance({
    nomination,
    identity: verifiedCanadaVoter,
  });
  assert(guidance.recommendsCandidate === false, "Assistant must not recommend candidates");
  assert(guidance.canVote === true, "Eligible voter guidance must allow voting");

  await closeCivicNominationVoting(countryDraft.nominationId, adminIdentity);

  await drainCivicNotificationEventsForTests();
  const notifications = await listMyNotifications({ userId: nominatorAuth.userId });
  assert(
    notifications.notifications.some(
      (notification) => notification.eventType === "civic_nomination_voting_opened",
    ),
    "Voting opened notification must be recorded",
  );
  assert(
    notifications.notifications.some(
      (notification) => notification.eventType === "civic_nomination_voting_closed",
    ),
    "Voting closed notification must be recorded",
  );

  await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
  await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
}

async function main(): Promise<void> {
  verifyModuleStructure();
  await verifyRuntimeBehavior();
  console.log("\nverify:civic-nomination-voting PASS");
}

const { runVerificationScript } = await import("./verification-script-lifecycle.js");
void runVerificationScript(main);
