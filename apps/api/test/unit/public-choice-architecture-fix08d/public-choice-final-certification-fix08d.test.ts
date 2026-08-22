/**
 * Public Choice Fix 08D — Final candidate CRUD + admin moderation certification.
 * Certification only — proves Fix 08A/08B/08C contracts; no product changes.
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
  PUBLIC_CHOICE_MAX_CANDIDATES,
  isInitiativeAdministrativelyBlocked,
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
  blockAdminInitiative,
  unblockAdminInitiative,
} from "../../../src/modules/administration/admin-initiative-moderation.service.js";
import { listAdminInitiatives } from "../../../src/modules/administration/admin-initiative-directory.service.js";
import {
  blockAdminPublicChoiceCandidate,
  getAdminPublicChoiceDetail,
  listAdminPublicChoiceElections,
  unblockAdminPublicChoiceCandidate,
  updateAdminPublicChoiceCandidate,
} from "../../../src/modules/administration/admin-public-choice.service.js";
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/index.js";
import {
  PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE,
  PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE,
  PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE,
  PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE,
  PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE,
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  listPublicChoiceCandidatesForInitiative,
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
import {
  republishInitiative,
  updateManagedInitiative,
} from "../../../src/modules/initiatives/initiative.service.js";
import { closePublicChoiceElectionForInitiative } from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.service.js";
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
import { assertCanUploadPublicChoiceCandidateMedia } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `fix08d-${testRunId}`;

const steward: RequestIdentity = { participantId: `fix08d-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix08d-participant-${testRunId}` };
const otherParticipant: RequestIdentity = { participantId: `fix08d-other-${testRunId}` };
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
    title: `${profile} Fix 08D ${initiativeId}`,
    description: "Certification election",
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
      email: `${emailPrefix}-${label}@fix08d.test`,
      password: "Password123!",
      displayName: `Fix08D ${label}`,
      role,
    },
    memberId,
  );
  return { userId: user.userId, participantId: memberId };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  for (const id of [
    steward.participantId,
    participant.participantId,
    otherParticipant.participantId,
  ]) {
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

describe("Public Choice Fix 08D — Participant CRUD + max-20 + delete safety", () => {
  it("Participant/Author CRUD ownership; Visitor denied; photo upload gate for PC", async () => {
    const initiativeId = trackInitiative(`initiative-fix08d-crud-${testRunId}`);
    const initiative = buildInitiative(initiativeId, "PUBLIC_CHOICE");
    createInitiative(initiative);

    const created = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Owned",
      photoUrl: "https://example.com/photo.jpg",
    });
    const stored = await getPublicChoiceCandidateById(created.candidateId);
    assert.equal(stored?.submittedByParticipantId, participant.participantId);
    assert.equal(stored?.photoUrl, "https://example.com/photo.jpg");

    const listed = await listPublicChoiceCandidatesForInitiative(initiativeId, participant);
    assert.ok(listed.some((row) => row.candidateId === created.candidateId));

    await updatePublicChoiceCandidateForInitiative(participant, initiativeId, created.candidateId, {
      name: "Owned Edited",
    });
    assert.equal(
      (await getPublicChoiceCandidateById(created.candidateId))?.name,
      "Owned Edited",
    );

    const peer = await createPublicChoiceCandidateForInitiative(otherParticipant, initiativeId, {
      name: "Peer",
    });
    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, peer.candidateId, {
          name: "Hijack",
        }),
      /access to modify/,
    );
    await assert.rejects(
      () => deletePublicChoiceCandidateForInitiative(participant, initiativeId, peer.candidateId),
      /access to modify/,
    );

    await updatePublicChoiceCandidateForInitiative(steward, initiativeId, peer.candidateId, {
      name: "Author Managed",
    });

    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative({} as RequestIdentity, initiativeId, {
          name: "Visitor",
        }),
      /Authentication required/,
    );

    assert.doesNotThrow(() =>
      assertCanUploadPublicChoiceCandidateMedia(initiative, participant),
    );
    const standard = buildInitiative(
      trackInitiative(`initiative-fix08d-std-media-${testRunId}`),
      "STANDARD",
    );
    createInitiative(standard);
    assert.throws(
      () => assertCanUploadPublicChoiceCandidateMedia(standard, participant),
      /access to this initiative/,
    );

    await deletePublicChoiceCandidateForInitiative(participant, initiativeId, created.candidateId);
    assert.equal(await getPublicChoiceCandidateById(created.candidateId), null);
  });

  it("accepts 20 candidates; rejects 21st; blocked candidate still consumes a slot", async () => {
    const admin = await insertAccount("limit-admin", "admin");
    const initiativeId = trackInitiative(`initiative-fix08d-limit-${testRunId}`);
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));

    const ids: string[] = [];
    for (let i = 0; i < PUBLIC_CHOICE_MAX_CANDIDATES; i += 1) {
      const row = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
        name: `Cand ${i + 1}`,
      });
      ids.push(row.candidateId);
    }
    assert.equal(ids.length, 20);

    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative(steward, initiativeId, {
          name: "Cand 21",
        }),
      (error: unknown) =>
        error instanceof Error && error.message === PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE,
    );

    await blockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: ids[0]!,
    });
    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative(steward, initiativeId, {
          name: "Cand 21 after block",
        }),
      (error: unknown) =>
        error instanceof Error && error.message === PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE,
    );
  });

  it("delete safety: votes block hard-delete; zero-vote blocked candidate locked for steward", async () => {
    const admin = await insertAccount("delete-admin", "admin");
    const initiativeId = trackInitiative(`initiative-fix08d-delete-${testRunId}`);
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));
    const decisionId = trackDecision(`collective-decision-fix08d-delete-${testRunId}`);
    openDecision(initiativeId, decisionId);

    const voted = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Has Votes",
    });
    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: voted.candidateId,
    });
    await assert.rejects(
      () => deletePublicChoiceCandidateForInitiative(steward, initiativeId, voted.candidateId),
      (error: unknown) =>
        error instanceof Error &&
        error.message === PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE,
    );

    const zeroVote = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Zero Blocked",
    });
    await blockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: zeroVote.candidateId,
    });
    await assert.rejects(
      () =>
        deletePublicChoiceCandidateForInitiative(participant, initiativeId, zeroVote.candidateId),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () => deletePublicChoiceCandidateForInitiative(steward, initiativeId, zeroVote.candidateId),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
  });
});

describe("Public Choice Fix 08D — Candidate + election moderation certification", () => {
  it("candidate block/unblock hierarchy; election freeze; CLOSED stays CLOSED; messages; audits", async () => {
    const admin = await insertAccount("mod-admin", "admin");
    const member = await insertAccount("mod-member", "member");
    const initiativeId = trackInitiative(`initiative-fix08d-mod-${testRunId}`);
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));
    const decisionId = trackDecision(`collective-decision-fix08d-mod-${testRunId}`);
    openDecision(initiativeId, decisionId);

    const candidateA = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Candidate A",
    });
    const candidateB = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate B",
    });

    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: candidateA.candidateId,
    });

    await assert.rejects(
      () =>
        blockAdminPublicChoiceCandidate({
          actorUserId: member.userId,
          initiativeId,
          candidateId: candidateA.candidateId,
        }),
      /Administrator access is required/,
    );

    await blockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: candidateA.candidateId,
      reason: "internal note",
    });

    const projection = toPublicChoiceCandidatePublicProjection(
      (await getPublicChoiceCandidateById(candidateA.candidateId))!,
    );
    assert.equal(projection.isBlocked, true);
    assert.equal("administrativeBlockReason" in projection, false);
    assert.equal("administrativelyBlockedByParticipantId" in projection, false);

    const aggregatesAfterBlock = await computePublicChoiceBallotAggregatesForDecision(
      decisionId,
      getInitiativeById(initiativeId)!,
    );
    assert.equal(aggregatesAfterBlock.ballotMode, "SELECT_ONE_CANDIDATE");
    if (aggregatesAfterBlock.ballotMode === "SELECT_ONE_CANDIDATE") {
      const tally = aggregatesAfterBlock.candidates.find(
        (row) => row.candidateId === candidateA.candidateId,
      );
      assert.equal(tally?.count, 1);
    }

    await assert.rejects(
      () =>
        castOrUpdateVisitorInitiativeDecisionVote(`visitor-new-${testRunId}`, decisionId, {
          choice: "candidate",
          candidateId: candidateA.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_BLOCKED_SELECT_MESSAGE),
    );

    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, candidateA.candidateId, {
          name: "Nope",
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(steward, initiativeId, candidateA.candidateId, {
          name: "Nope",
        }),
      new RegExp(PUBLIC_CHOICE_CANDIDATE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );

    const adminEdited = await updateAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: candidateA.candidateId,
      name: "Admin Edited A",
    });
    assert.equal(adminEdited.name, "Admin Edited A");

    await recallInitiativeDecisionVote(participant, decisionId);
    await castOrUpdateInitiativeDecisionVote(participant, decisionId, {
      choice: "candidate",
      candidateId: candidateB.candidateId,
    });

    await assert.rejects(
      () =>
        unblockAdminPublicChoiceCandidate({
          actorUserId: member.userId,
          initiativeId,
          candidateId: candidateA.candidateId,
        }),
      /Administrator access is required/,
    );

    // Parent election blocked → candidate unblock does not enable Select.
    await blockAdminInitiative({
      actorUserId: admin.userId,
      initiativeId,
      reason: "freeze election",
    });
    await unblockAdminPublicChoiceCandidate({
      actorUserId: admin.userId,
      initiativeId,
      candidateId: candidateA.candidateId,
    });
    assert.equal(
      isPublicChoiceCandidateAdministrativelyBlocked(
        (await getPublicChoiceCandidateById(candidateA.candidateId))!,
      ),
      false,
    );
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(steward, decisionId, {
          choice: "candidate",
          candidateId: candidateA.candidateId,
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    await assert.rejects(
      () =>
        castOrUpdateVisitorInitiativeDecisionVote(`visitor-freeze-${testRunId}`, decisionId, {
          choice: "candidate",
          candidateId: candidateB.candidateId,
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
          name: "During freeze",
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_BLOCKED_INTERACTION_MESSAGE),
    );
    assert.throws(
      () =>
        updateManagedInitiative(steward, initiativeId, {
          title: "Blocked Update",
        }),
      new RegExp(PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    assert.throws(
      () => republishInitiative(steward, initiativeId, {}),
      new RegExp(PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await assert.rejects(
      () => closePublicChoiceElectionForInitiative(steward, initiativeId),
      new RegExp(PUBLIC_CHOICE_ELECTION_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );

    await unblockAdminInitiative({ actorUserId: admin.userId, initiativeId });
    assert.equal(isInitiativeAdministrativelyBlocked(getInitiativeById(initiativeId)!), false);

    // Unblocked + OPEN → Candidate A selectable again.
    await castOrUpdateInitiativeDecisionVote(steward, decisionId, {
      choice: "candidate",
      candidateId: candidateA.candidateId,
    });

    // CLOSED stays CLOSED on unblock.
    updateDecision(decisionId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    const closedAt = getDecisionById(decisionId)?.closedAt;
    await blockAdminInitiative({ actorUserId: admin.userId, initiativeId });
    await unblockAdminInitiative({ actorUserId: admin.userId, initiativeId });
    assert.equal(getDecisionById(decisionId)?.status, "closed");
    assert.equal(getDecisionById(decisionId)?.closedAt, closedAt);
    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(participant, decisionId, {
          choice: "candidate",
          candidateId: candidateB.candidateId,
        }),
      /not open for voting/i,
    );

    // Retention: block != expire/close metadata.
    assert.equal(getInitiativeById(initiativeId)?.metadata.publicChoiceResultsExpireAt, undefined);
    assert.equal(getInitiativeById(initiativeId)?.metadata.publicChoiceResultsExpiredAt, undefined);

    const initiativeAudits = await listAdministrationAuditsForTarget({
      targetType: "initiative",
      targetId: initiativeId,
    });
    assert.ok(initiativeAudits.some((row) => row.action === "initiative.administrative.block"));
    assert.ok(initiativeAudits.some((row) => row.action === "initiative.administrative.unblock"));
    const candidateAudits = await listAdministrationAuditsForTarget({
      targetType: "public_choice_candidate",
      targetId: candidateA.candidateId,
    });
    assert.ok(candidateAudits.some((row) => row.action === "public_choice.candidate.block"));
    assert.ok(candidateAudits.some((row) => row.action === "public_choice.candidate.unblock"));
  });

  it("STANDARD moderation + Admin list separation + legacy PC + Admin UI contracts", async () => {
    const admin = await insertAccount("sep-admin", "admin");
    const member = await insertAccount("sep-member", "member");
    const standardId = trackInitiative(`initiative-fix08d-std-${testRunId}`);
    const pcId = trackInitiative(`initiative-fix08d-pc-${testRunId}`);
    const legacyId = trackInitiative(`initiative-1787189571159-fix08d-${testRunId}`);
    createInitiative(buildInitiative(standardId, "STANDARD"));
    createInitiative(buildInitiative(pcId, "PUBLIC_CHOICE"));
    createInitiative(buildInitiative(legacyId, "PUBLIC_CHOICE"));

    const stdList = await listAdminInitiatives({ actorUserId: admin.userId, limit: 200 });
    assert.ok(stdList.initiatives.some((row) => row.initiativeId === standardId));
    assert.equal(
      stdList.initiatives.some((row) => row.initiativeId === pcId),
      false,
    );

    const pcList = await listAdminPublicChoiceElections({
      actorUserId: admin.userId,
      limit: 200,
    });
    assert.ok(pcList.elections.some((row) => row.initiativeId === pcId));
    assert.ok(pcList.elections.some((row) => row.initiativeId === legacyId));
    assert.equal(
      pcList.elections.some((row) => row.initiativeId === standardId),
      false,
    );
    const legacyRow = pcList.elections.find((row) => row.initiativeId === legacyId);
    assert.equal(legacyRow?.administrativelyBlocked, false);

    await assert.rejects(
      () => blockAdminInitiative({ actorUserId: member.userId, initiativeId: standardId }),
      /Administrator access is required/,
    );
    await blockAdminInitiative({ actorUserId: admin.userId, initiativeId: standardId });
    assert.throws(
      () =>
        updateManagedInitiative(steward, standardId, {
          title: "Blocked STANDARD",
        }),
      new RegExp(INITIATIVE_ADMIN_BLOCKED_MUTATION_MESSAGE),
    );
    await unblockAdminInitiative({ actorUserId: admin.userId, initiativeId: standardId });

    const detail = await getAdminPublicChoiceDetail({
      actorUserId: admin.userId,
      initiativeId: pcId,
    });
    assert.equal(typeof detail.electionTitle, "string");
    assert.equal(typeof detail.votingStatus, "string");
    assert.equal(typeof detail.candidateCount, "number");
    assert.equal(typeof detail.administrativelyBlocked, "boolean");
    assert.ok(Array.isArray(detail.candidates));

    const sections = readRepo(
      "apps/web/src/features/administration/admin-panel-sections.ts",
    );
    assert.match(sections, /Initiatives[\s\S]*Public Choice[\s\S]*Publishing/);
    const overview = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const submit = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    const adminList = readRepo(
      "apps/web/src/features/administration/components/AdminPublicChoiceSection.tsx",
    );
    const adminDetail = readRepo(
      "apps/web/src/features/administration/components/AdminPublicChoiceDetailSection.tsx",
    );
    assert.match(overview, /This election has been blocked by an administrator/);
    assert.match(submit, /Up to \{PUBLIC_CHOICE_MAX_CANDIDATES\} candidates/);
    assert.match(submit, /candidateCount\} of \{PUBLIC_CHOICE_MAX_CANDIDATES\}/);
    assert.match(adminList, /Block election\?/);
    assert.match(adminDetail, /Block candidate\?/);
    assert.match(adminDetail, /updateAdminPublicChoiceCandidate/);
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
  });
});
