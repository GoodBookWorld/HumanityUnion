/**
 * Public Choice Fix 08B — Candidate administrative block state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";
import {
  isPublicChoiceCandidateAdministrativelyBlocked,
  toPublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  blockPublicChoiceCandidateAsAdmin,
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  listPublicChoiceCandidatesForInitiative,
  PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE,
  unblockPublicChoiceCandidateAsAdmin,
  updatePublicChoiceCandidateForInitiative,
} from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import {
  deletePublicChoiceCandidatesByInitiativeForTests,
  getPublicChoiceCandidateById,
} from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { seedMember } from "../../../src/modules/member/member.store.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  computePublicChoiceBallotAggregatesForDecision,
  recallInitiativeDecisionVote,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import { deleteVotesByDecisionIdForTests } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import {
  createDecision,
  getDecisionById,
  updateDecision,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import { purgeExpiredPublicChoiceElectionData } from "../../../src/modules/public-choice-results-retention/public-choice-results-retention.service.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `fix08b-${testRunId}`;

const steward: RequestIdentity = { participantId: `fix08b-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix08b-participant-${testRunId}` };
const trackedInitiativeIds: string[] = [];
const trackedDecisionIds: string[] = [];

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function trackInitiative(id: string): string {
  trackedInitiativeIds.push(id);
  return id;
}

function trackDecision(id: string): string {
  trackedDecisionIds.push(id);
  return id;
}

function buildMember(id: string): Member {
  return {
    id,
    profile: {
      displayName: id,
      uniqueName: id.replace(/[^a-z0-9-_]/gi, "-"),
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

function buildPublicChoiceInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Fix 08B Election",
    description: "Candidate admin block",
    status: "discussion",
    lifecyclePhase: "discussion",
    lifecycleProfile: "PUBLIC_CHOICE",
    visibility: { policy: "public" },
    metadata: {
      category: "",
      tags: [],
      region: "",
      language: "en",
      countrySlug: "us",
      communitySlug: "",
      participationScope: "country",
      activityArea: "",
      ballotMode: "SELECT_ONE_CANDIDATE",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function openDecision(initiativeId: string, decisionId: string): InitiativeCollectiveDecision {
  return createDecision({
    decisionId,
    initiativeId,
    decisionSessionId: null,
    stewardId: steward.participantId,
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Who?",
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function insertAccount(label: string, role: "admin" | "member") {
  const memberId = randomUUID();
  const user = await insertAuthUser(
    {
      email: `${emailPrefix}-${label}@fix08b.test`,
      password: "Password123!",
      displayName: `Fix08B ${label}`,
      role,
    },
    memberId,
  );
  return { userId: user.userId, participantId: memberId };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  for (const id of [steward.participantId, participant.participantId]) {
    seedMember(buildMember(id));
  }
});

after(async () => {
  for (const decisionId of trackedDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
  }
  for (const initiativeId of trackedInitiativeIds) {
    await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    try {
      deleteInitiative(initiativeId);
    } catch {
      // gone
    }
  }
  await deleteAuthUsersByEmailPrefix(`${emailPrefix}-`);
  const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
  const uri = process.env.MONGODB_URI?.trim();
  if (isolatedName?.startsWith("hu_test_") && uri) {
    try {
      await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
    } catch {
      // best-effort
    }
  }
  await disconnectMongoClient();
});

describe("Public Choice Fix 08B — block contract + admin authority", () => {
  it("legacy Candidate defaults unblocked; projection hides admin internals", () => {
    const legacy = {
      candidateId: "legacy",
      initiativeId: "init",
      name: "Legacy",
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assert.equal(isPublicChoiceCandidateAdministrativelyBlocked(legacy), false);
    const projection = toPublicChoiceCandidatePublicProjection({
      ...legacy,
      administrativelyBlocked: true,
      administrativelyBlockedAt: new Date().toISOString(),
      administrativelyBlockedByParticipantId: "admin-participant",
      administrativeBlockReason: "internal note",
    });
    assert.equal(projection.isBlocked, true);
    assert.equal(
      "administrativelyBlockedByParticipantId" in projection ||
        "administrativeBlockReason" in projection ||
        "administrativelyBlockedAt" in projection,
      false,
    );
  });

  it("admin can block/unblock; non-admin cannot", async () => {
    const initiativeId = trackInitiative(`initiative-fix08b-admin-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    const created = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Block Target",
    });
    const admin = await insertAccount("admin", "admin");
    const member = await insertAccount("member", "member");

    await assert.rejects(
      () =>
        blockPublicChoiceCandidateAsAdmin({
          actorUserId: member.userId,
          initiativeId,
          candidateId: created.candidateId,
          reason: "spam",
        }),
      /Administrator access is required/,
    );
    await assert.rejects(
      () =>
        unblockPublicChoiceCandidateAsAdmin({
          actorUserId: member.userId,
          initiativeId,
          candidateId: created.candidateId,
        }),
      /Administrator access is required/,
    );

    const blocked = await blockPublicChoiceCandidateAsAdmin({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: created.candidateId,
      reason: "policy violation",
    });
    assert.equal(blocked.administrativelyBlocked, true);
    assert.equal(blocked.administrativelyBlockedByParticipantId, admin.participantId);
    assert.equal(blocked.administrativeBlockReason, "policy violation");
    assert.ok(blocked.administrativelyBlockedAt);

    const listed = await listPublicChoiceCandidatesForInitiative(initiativeId, steward);
    const publicRow = listed.find((row) => row.candidateId === created.candidateId);
    assert.equal(publicRow?.isBlocked, true);
    assert.equal(publicRow?.viewerCanManage, undefined);
    assert.equal(
      "administrativelyBlockedByParticipantId" in (publicRow ?? {}) ||
        "administrativeBlockReason" in (publicRow ?? {}),
      false,
    );

    const unblocked = await unblockPublicChoiceCandidateAsAdmin({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: created.candidateId,
    });
    assert.equal(isPublicChoiceCandidateAdministrativelyBlocked(unblocked), false);
    assert.equal(unblocked.administrativelyBlockedByParticipantId, undefined);
    assert.equal(unblocked.administrativeBlockReason, undefined);
  });
});

describe("Public Choice Fix 08B — votes / recall / CRUD lock / results / retention", () => {
  it("rejects new Select; preserves votes; allows Recall; locks mutate; closed stays closed; purge removes block metadata", async () => {
    const initiativeId = trackInitiative(`initiative-fix08b-votes-${testRunId}`);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);
    const admin = await insertAccount("admin-votes", "admin");

    const primary = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Primary",
    });
    const alternate = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Alternate",
    });

    const decisionId = trackDecision(`collective-decision-fix08b-${testRunId}`);
    openDecision(initiativeId, decisionId);

    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: primary.candidateId,
    });
    await castOrUpdateVisitorInitiativeDecisionVote(`visitor-${testRunId}`, decisionId, {
      choice: "candidate",
      candidateId: alternate.candidateId,
    });

    await blockPublicChoiceCandidateAsAdmin({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: primary.candidateId,
      reason: "moderation",
    });

    const aggregatesAfterBlock = await computePublicChoiceBallotAggregatesForDecision(
      decisionId,
      getInitiativeById(initiativeId)!,
    );
    assert.equal(aggregatesAfterBlock.ballotMode, "SELECT_ONE_CANDIDATE");
    if (aggregatesAfterBlock.ballotMode === "SELECT_ONE_CANDIDATE") {
      const primaryTally = aggregatesAfterBlock.candidates.find(
        (row) => row.candidateId === primary.candidateId,
      );
      assert.ok(primaryTally);
      assert.equal(primaryTally.count, 1);
    }

    await assert.rejects(
      () =>
        castOrUpdateVisitorInitiativeDecisionVote(`visitor-new-${testRunId}`, decisionId, {
          choice: "candidate",
          candidateId: primary.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE),
    );
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(steward, decisionId, {
          choice: "candidate",
          candidateId: primary.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE),
    );

    await recallInitiativeDecisionVote(participant, decisionId);
    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: alternate.candidateId,
    });

    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, primary.candidateId, {
          name: "Hijack",
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () =>
        deletePublicChoiceCandidateForInitiative(participant, initiativeId, primary.candidateId),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(steward, initiativeId, primary.candidateId, {
          name: "Steward Hijack",
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () => deletePublicChoiceCandidateForInitiative(steward, initiativeId, primary.candidateId),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );

    updateDecision(decisionId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    assert.equal(getDecisionById(decisionId)?.status, "closed");

    await unblockPublicChoiceCandidateAsAdmin({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: primary.candidateId,
    });
    assert.equal(getDecisionById(decisionId)?.status, "closed");
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(participant, decisionId, {
          choice: "candidate",
          candidateId: primary.candidateId,
        }),
      /not open for voting/i,
    );

    // Re-block for retention purge coverage (block metadata on Candidate document).
    await blockPublicChoiceCandidateAsAdmin({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: primary.candidateId,
    });
    const blockedStored = await getPublicChoiceCandidateById(primary.candidateId);
    assert.equal(blockedStored?.administrativelyBlocked, true);

    const expireAt = new Date(Date.now() - 60_000).toISOString();
    updateInitiative(initiativeId, {
      metadata: {
        ...getInitiativeById(initiativeId)!.metadata,
        publicChoiceResultsExpireAt: expireAt,
      },
    });
    const purge = await purgeExpiredPublicChoiceElectionData({
      initiative: getInitiativeById(initiativeId)!,
      decisionId,
      nowIso: new Date().toISOString(),
    });
    assert.equal(purge.purged, true);
    assert.equal(await getPublicChoiceCandidateById(primary.candidateId), null);
  });

  it("STANDARD media ownership path unchanged; Fix 08A contracts still present", () => {
    const media = readRepo("apps/api/src/modules/media-upload/media-upload.routes.ts");
    const service = readRepo(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    const overview = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(media, /assertCanUploadPublicChoiceCandidateMedia/);
    assert.match(service, /PUBLIC_CHOICE_MAX_CANDIDATES/);
    assert.match(service, /blockPublicChoiceCandidateAsAdmin/);
    assert.match(service, /assertCandidateAcceptsNewSelectVote/);
    assert.match(overview, /candidate\.isBlocked/);
    assert.match(overview, /Blocked/);
    assert.match(overview, /pc-overview-vote-row__recall/);
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
  });
});
