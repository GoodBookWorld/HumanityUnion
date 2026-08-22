/**
 * Public Choice Fix 08A — Participant candidate CRUD + 20-candidate limit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";
import { PUBLIC_CHOICE_MAX_CANDIDATES } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  canManagePublicChoiceCandidate,
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE,
  PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE,
  updatePublicChoiceCandidateForInitiative,
} from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { getPublicChoiceCandidateById } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { seedMember } from "../../../src/modules/member/member.store.js";
import {
  castOrUpdateInitiativeDecisionVote,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import { deleteVotesByDecisionIdForTests } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { createDecision } from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `fix08a-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix08a-participant-${testRunId}` };
const otherParticipant: RequestIdentity = { participantId: `fix08a-other-${testRunId}` };
const member: RequestIdentity = { participantId: `fix08a-member-${testRunId}` };
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
      uniqueName: id.replace(/[^a-z0-9]/gi, "-"),
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
    title: "Fix 08A Election",
    description: "Candidate CRUD",
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

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  for (const id of [
    steward.participantId,
    participant.participantId,
    otherParticipant.participantId,
    member.participantId,
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

describe("Public Choice Fix 08A — permission root cause + create", () => {
  it("root cause is initiative-image assertInitiativeOwnership (not candidate create)", () => {
    const media = readRepo("apps/api/src/modules/media-upload/media-upload.routes.ts");
    const service = readRepo(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    assert.match(media, /assertCanUploadPublicChoiceCandidateMedia/);
    assert.doesNotMatch(
      service,
      /createPublicChoiceCandidateForInitiative[\s\S]{0,400}assertInitiativeOwnership/,
    );
    assert.match(service, /submittedByParticipantId: participantId/);
  });

  it("Participant / Member / Author can create; Visitor identity rejected; ownership persists", async () => {
    const initiativeId = trackInitiative(`initiative-fix08a-create-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const byParticipant = await createPublicChoiceCandidateForInitiative(
      participant,
      initiativeId,
      { name: "P Candidate" },
    );
    const stored = await getPublicChoiceCandidateById(byParticipant.candidateId);
    assert.equal(stored?.submittedByParticipantId, participant.participantId);
    assert.equal(byParticipant.viewerCanManage, true);

    const byMember = await createPublicChoiceCandidateForInitiative(member, initiativeId, {
      name: "M Candidate",
    });
    assert.equal(
      (await getPublicChoiceCandidateById(byMember.candidateId))?.submittedByParticipantId,
      member.participantId,
    );

    const byAuthor = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "A Candidate",
    });
    assert.equal(
      (await getPublicChoiceCandidateById(byAuthor.candidateId))?.submittedByParticipantId,
      steward.participantId,
    );

    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative({} as RequestIdentity, initiativeId, {
          name: "Visitor",
        }),
      /Authentication required/,
    );
  });
});

describe("Public Choice Fix 08A — edit / delete / vote-safety / limit", () => {
  it("own edit/delete; peer denied; steward all; legacy steward; vote-safety; 20 limit", async () => {
    const initiativeId = trackInitiative(`initiative-fix08a-crud-${testRunId}`);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);

    const mine = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Mine",
    });
    const theirs = await createPublicChoiceCandidateForInitiative(otherParticipant, initiativeId, {
      name: "Theirs",
    });

    await updatePublicChoiceCandidateForInitiative(participant, initiativeId, mine.candidateId, {
      name: "Mine Updated",
    });
    assert.equal(
      (await getPublicChoiceCandidateById(mine.candidateId))?.name,
      "Mine Updated",
    );

    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, theirs.candidateId, {
          name: "Hijack",
        }),
      /access to modify/,
    );

    await updatePublicChoiceCandidateForInitiative(steward, initiativeId, theirs.candidateId, {
      name: "Steward Edited",
    });

    const legacyId = (
      await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
        name: "Legacy",
      })
    ).candidateId;
    // Simulate legacy missing submitter
    const legacyDoc = await getPublicChoiceCandidateById(legacyId);
    assert.ok(legacyDoc);
    const { updatePublicChoiceCandidate } = await import(
      "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js"
    );
    await updatePublicChoiceCandidate({
      ...legacyDoc,
      submittedByParticipantId: undefined,
      updatedAt: new Date().toISOString(),
    });
    const legacy = await getPublicChoiceCandidateById(legacyId);
    assert.ok(legacy);
    assert.equal(legacy.submittedByParticipantId, undefined);
    assert.equal(
      canManagePublicChoiceCandidate({
        initiative,
        participantId: steward.participantId,
        candidate: legacy,
      }),
      true,
    );
    assert.equal(
      canManagePublicChoiceCandidate({
        initiative,
        participantId: participant.participantId,
        candidate: legacy,
      }),
      false,
    );
    await updatePublicChoiceCandidateForInitiative(steward, initiativeId, legacyId, {
      name: "Legacy Fixed",
    });

    await deletePublicChoiceCandidateForInitiative(participant, initiativeId, mine.candidateId);
    assert.equal(await getPublicChoiceCandidateById(mine.candidateId), null);

    await assert.rejects(
      () =>
        deletePublicChoiceCandidateForInitiative(participant, initiativeId, theirs.candidateId),
      /access to modify/,
    );

    const zeroVote = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Zero Vote",
    });
    await deletePublicChoiceCandidateForInitiative(steward, initiativeId, zeroVote.candidateId);

    const voted = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Has Vote",
    });
    const decisionId = trackDecision(`collective-decision-fix08a-${testRunId}`);
    createDecision({
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
    } satisfies InitiativeCollectiveDecision);
    await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: voted.candidateId },
      {
        getDecision: (id) => (id === decisionId ? ({ decisionId, initiativeId, status: "opened", openedAt: new Date().toISOString(), closesAt: new Date(Date.now() + 3_600_000).toISOString() } as InitiativeCollectiveDecision) : null),
        getInitiative: (id) => (id === initiativeId ? initiative : null),
      },
    );
    await assert.rejects(
      () => deletePublicChoiceCandidateForInitiative(steward, initiativeId, voted.candidateId),
      (error: unknown) =>
        error instanceof Error &&
        error.message === PUBLIC_CHOICE_CANDIDATE_DELETE_VOTE_SAFETY_MESSAGE,
    );

    const limitInitiativeId = trackInitiative(`initiative-fix08a-limit-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(limitInitiativeId));
    for (let i = 0; i < PUBLIC_CHOICE_MAX_CANDIDATES; i += 1) {
      await createPublicChoiceCandidateForInitiative(steward, limitInitiativeId, {
        name: `Cand ${i + 1}`,
      });
    }
    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative(steward, limitInitiativeId, {
          name: "Cand 21",
        }),
      (error: unknown) =>
        error instanceof Error && error.message === PUBLIC_CHOICE_CANDIDATE_LIMIT_MESSAGE,
    );
  });
});

describe("Public Choice Fix 08A — UI + media contracts", () => {
  it("form helper, create/edit mode, delete confirm, Overview Edit action", () => {
    const form = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    const overview = readRepo(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(form, /Up to \{PUBLIC_CHOICE_MAX_CANDIDATES\} candidates/);
    assert.match(form, /Edit candidate/);
    assert.match(form, /Save changes/);
    assert.match(form, /Delete candidate\?/);
    assert.match(form, /Delete candidate/);
    assert.match(form, /Cancel/);
    assert.match(overview, /viewerCanManage/);
    assert.match(overview, /openEditForm/);
    assert.match(overview, /PUBLIC_CHOICE_MAX_CANDIDATES/);
  });

  it("runs against isolated hu_test_* database", () => {
    const configured = process.env[TEST_DATABASE_ENV_VAR] ?? resolveMongoConfig().database;
    assert.match(configured, /^hu_test_[a-zA-Z0-9_]+$/);
  });
});
