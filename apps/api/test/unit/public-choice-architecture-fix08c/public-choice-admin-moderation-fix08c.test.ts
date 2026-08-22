/**
 * Public Choice Fix 08C — Admin Public Choice management + Initiative block.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";
import {
  INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE,
  isInitiativeAdministrativelyBlocked,
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
  blockAdminInitiative,
  unblockAdminInitiative,
} from "../../../src/modules/administration/admin-initiative-moderation.service.js";
import { listAdminInitiatives } from "../../../src/modules/administration/admin-initiative-directory.service.js";
import {
  getAdminPublicChoiceDetail,
  listAdminPublicChoiceElections,
  blockAdminPublicChoiceCandidate,
  unblockAdminPublicChoiceCandidate,
  updateAdminPublicChoiceCandidate,
} from "../../../src/modules/administration/admin-public-choice.service.js";
import {
  createPublicChoiceCandidateForInitiative,
  PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE,
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
} from "../../../src/modules/initiatives/initiative.store.js";
import { updateManagedInitiative } from "../../../src/modules/initiatives/initiative.service.js";
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
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/index.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `fix08c-${testRunId}`;

const steward: RequestIdentity = { participantId: `fix08c-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix08c-participant-${testRunId}` };
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

function buildInitiative(
  initiativeId: string,
  profile: "STANDARD" | "PUBLIC_CHOICE",
): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: `${profile} Fix 08C ${initiativeId}`,
    description: "Admin moderation",
    status: "discussion",
    lifecyclePhase: "projected",
    lifecycleProfile: profile,
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
      ...(profile === "PUBLIC_CHOICE" ? { ballotMode: "SELECT_ONE_CANDIDATE" as const } : {}),
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
      email: `${emailPrefix}-${label}@fix08c.test`,
      password: "Password123!",
      displayName: `Fix08C ${label}`,
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

describe("Public Choice Fix 08C — list separation + STANDARD block", () => {
  it("nav places Public Choice between Initiatives and Publishing", () => {
    const sections = readRepo(
      "apps/web/src/features/administration/admin-panel-sections.ts",
    );
    assert.match(
      sections,
      /Initiatives[\s\S]*Public Choice[\s\S]*Publishing/,
    );
  });

  it("Admin Initiatives = STANDARD only; Public Choice = PUBLIC_CHOICE only; legacy appears", async () => {
    const admin = await insertAccount("dir-admin", "admin");
    const standardId = trackInitiative(`initiative-fix08c-std-${testRunId}`);
    const pcId = trackInitiative(`initiative-fix08c-pc-${testRunId}`);
    const legacyPcId = trackInitiative(`initiative-1787189571159-fix08c-${testRunId}`);
    createInitiative(buildInitiative(standardId, "STANDARD"));
    createInitiative(buildInitiative(pcId, "PUBLIC_CHOICE"));
    const legacy = buildInitiative(legacyPcId, "PUBLIC_CHOICE");
    delete (legacy as { administrativelyBlocked?: boolean }).administrativelyBlocked;
    createInitiative(legacy);

    const initiatives = await listAdminInitiatives({ actorUserId: admin.userId, limit: 100 });
    assert.ok(initiatives.initiatives.some((row) => row.initiativeId === standardId));
    assert.equal(
      initiatives.initiatives.some((row) => row.initiativeId === pcId),
      false,
    );

    const elections = await listAdminPublicChoiceElections({
      actorUserId: admin.userId,
      limit: 100,
    });
    assert.ok(elections.elections.some((row) => row.initiativeId === pcId));
    assert.ok(elections.elections.some((row) => row.initiativeId === legacyPcId));
    assert.equal(
      elections.elections.some((row) => row.initiativeId === standardId),
      false,
    );
    const legacyRow = elections.elections.find((row) => row.initiativeId === legacyPcId);
    assert.equal(legacyRow?.administrativelyBlocked, false);
  });

  it("Admin can block/unblock STANDARD; non-admin and Author cannot", async () => {
    const admin = await insertAccount("std-admin", "admin");
    const member = await insertAccount("std-member", "member");
    const initiativeId = trackInitiative(`initiative-fix08c-block-std-${testRunId}`);
    createInitiative(buildInitiative(initiativeId, "STANDARD"));

    await assert.rejects(
      () => blockAdminInitiative({ actorUserId: member.userId, initiativeId }),
      /Administrator access is required/,
    );

    const blocked = await blockAdminInitiative({
      actorUserId: admin.userId,
      initiativeId,
      reason: "policy",
    });
    assert.equal(blocked.administrativelyBlocked, true);
    assert.equal(isInitiativeAdministrativelyBlocked(getInitiativeById(initiativeId)!), true);

    assert.throws(
      () =>
        updateManagedInitiative(steward, initiativeId, {
          title: "Hijack",
        }),
      new RegExp(INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );

    await assert.rejects(
      () => unblockAdminInitiative({ actorUserId: member.userId, initiativeId }),
      /Administrator access is required/,
    );

    const unblocked = await unblockAdminInitiative({
      actorUserId: admin.userId,
      initiativeId,
    });
    assert.equal(unblocked.administrativelyBlocked, false);
    const audits = await listAdministrationAuditsForTarget({
      targetType: "initiative",
      targetId: initiativeId,
    });
    assert.ok(audits.some((row) => row.action === "initiative.administrative.block"));
    assert.ok(audits.some((row) => row.action === "initiative.administrative.unblock"));
  });
});

describe("Public Choice Fix 08C — election block + candidate admin", () => {
  it("election freeze, hierarchy, admin edit, counts, closed stays closed", async () => {
    const admin = await insertAccount("pc-admin", "admin");
    const initiativeId = trackInitiative(`initiative-fix08c-election-${testRunId}`);
    const initiative = buildInitiative(initiativeId, "PUBLIC_CHOICE");
    createInitiative(initiative);

    const primary = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Primary",
    });
    const alternate = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Alternate",
    });

    const decisionId = trackDecision(`collective-decision-fix08c-${testRunId}`);
    openDecision(initiativeId, decisionId);

    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: primary.candidateId,
    });

    await blockAdminInitiative({
      actorUserId: admin.userId,
      initiativeId,
      reason: "freeze",
    });

    await assert.rejects(
      () =>
        castOrUpdateVisitorInitiativeDecisionVote(`visitor-${testRunId}`, decisionId, {
          choice: "candidate",
          candidateId: alternate.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(steward, decisionId, {
          choice: "candidate",
          candidateId: alternate.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    await assert.rejects(
      () => recallInitiativeDecisionVote(participant, decisionId),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative(participant, initiativeId, {
          name: "During Freeze",
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, primary.candidateId, {
          name: "Nope",
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );

    // Candidate unblock while election blocked must not enable Select.
    await blockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: alternate.candidateId,
    });
    await unblockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: alternate.candidateId,
    });
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(steward, decisionId, {
          choice: "candidate",
          candidateId: alternate.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );

    // Admin may edit blocked candidate (re-block then edit).
    await blockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: primary.candidateId,
    });
    const adminEdited = await updateAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: primary.candidateId,
      name: "Admin Renamed",
    });
    assert.equal(adminEdited.name, "Admin Renamed");
    assert.equal((await getPublicChoiceCandidateById(primary.candidateId))?.name, "Admin Renamed");

    const detail = await getAdminPublicChoiceDetail({
      actorUserId: admin.userId,
      initiativeId,
    });
    const aggregates = await computePublicChoiceBallotAggregatesForDecision(
      decisionId,
      getInitiativeById(initiativeId)!,
    );
    assert.equal(detail.administrativelyBlocked, true);
    assert.equal(detail.candidates.length, 2);
    if (aggregates.ballotMode === "SELECT_ONE_CANDIDATE") {
      assert.equal(detail.effectiveVoterCount, aggregates.totalEffectiveVoters);
      const primaryRow = detail.candidates.find((row) => row.candidateId === primary.candidateId);
      const tally = aggregates.candidates.find((row) => row.candidateId === primary.candidateId);
      assert.equal(primaryRow?.voteCount, tally?.count);
      assert.equal(primaryRow?.isBlocked, true);
    }

    updateDecision(decisionId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    const closedAt = getDecisionById(decisionId)?.closedAt;
    await unblockAdminInitiative({ actorUserId: admin.userId, initiativeId });
    assert.equal(getDecisionById(decisionId)?.status, "closed");
    assert.equal(getDecisionById(decisionId)?.closedAt, closedAt);
    assert.equal(
      isInitiativeAdministrativelyBlocked(getInitiativeById(initiativeId)!),
      false,
    );
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(participant, decisionId, {
          choice: "candidate",
          candidateId: alternate.candidateId,
        }),
      /not open for voting/i,
    );
  });

  it("messages and routes contracts present", () => {
    const overview = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const routes = readRepo(
      "apps/api/src/modules/administration/admin-public-choice.routes.ts",
    );
    assert.match(overview, /This election has been blocked by an administrator/);
    assert.match(routes, /adminPublicChoiceRouter/);
    assert.match(routes, /candidates\/:candidateId\/block/);
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
  });
});
