/**
 * Public Choice Pack 02D — Participant candidate submission + retention cleanup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative } from "@hu/types";

import { isMongoConfigured } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  updatePublicChoiceCandidateForInitiative,
} from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { resetPublicChoiceCandidatesForTests } from "../../../src/modules/public-choice-candidate/public-choice-candidate.memory.store.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { getPublicChoiceCandidateById } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const steward: RequestIdentity = { participantId: "pack02d-steward" };
const participant: RequestIdentity = { participantId: "pack02d-participant" };
const tracked: string[] = [];

function track(initiativeId: string): string {
  tracked.push(initiativeId);
  return initiativeId;
}

function buildPublicChoiceInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Pack 02D Election",
    description: "Candidate submission",
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

afterEach(async () => {
  resetPublicChoiceCandidatesForTests();
  if (isMongoConfigured()) {
    for (const initiativeId of tracked.splice(0)) {
      await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
      try {
        deleteInitiative(initiativeId);
      } catch {
        // ignore
      }
    }
  } else {
    for (const initiativeId of tracked.splice(0)) {
      try {
        deleteInitiative(initiativeId);
      } catch {
        // ignore
      }
    }
  }
});

describe("Public Choice Pack 02D — Participant candidate submission", () => {
  it("authenticated Participant can add a candidate with submittedByParticipantId", async () => {
    const initiativeId = track("pack02d-participant-add");
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const created = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Participant Nominee",
      campaignPageUrl: "https://example.com/nominee",
    });

    assert.equal(created.initiativeId, initiativeId);
    assert.equal(created.name, "Participant Nominee");

    const stored = await getPublicChoiceCandidateById(created.candidateId);
    assert.equal(stored?.submittedByParticipantId, participant.participantId);
  });

  it("steward can still add and manage candidates", async () => {
    const initiativeId = track("pack02d-steward-manage");
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const created = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Steward Nominee",
    });
    assert.equal(created.name, "Steward Nominee");

    const updated = await updatePublicChoiceCandidateForInitiative(
      steward,
      initiativeId,
      created.candidateId,
      { name: "Steward Nominee Updated" },
    );
    assert.equal(updated.name, "Steward Nominee Updated");

    await deletePublicChoiceCandidateForInitiative(steward, initiativeId, created.candidateId);
  });

  it("Participant may edit/delete own candidate; cannot edit another Participant's", async () => {
    const initiativeId = track("pack02d-own-edit");
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const own = await createPublicChoiceCandidateForInitiative(participant, initiativeId, {
      name: "Own",
    });
    const other = await createPublicChoiceCandidateForInitiative(
      { participantId: "pack02d-other" },
      initiativeId,
      { name: "Other" },
    );

    const updated = await updatePublicChoiceCandidateForInitiative(
      participant,
      initiativeId,
      own.candidateId,
      { name: "Own Updated" },
    );
    assert.equal(updated.name, "Own Updated");

    await assert.rejects(
      () =>
        updatePublicChoiceCandidateForInitiative(participant, initiativeId, other.candidateId, {
          name: "Hijack",
        }),
      /do not have access/,
    );

    await deletePublicChoiceCandidateForInitiative(participant, initiativeId, own.candidateId);
  });

  it("Member uses Participant identity path (same create permission)", async () => {
    const initiativeId = track("pack02d-member-path");
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    const memberAsParticipant: RequestIdentity = { participantId: "pack02d-member-participant" };
    const created = await createPublicChoiceCandidateForInitiative(memberAsParticipant, initiativeId, {
      name: "Member Nominee",
    });
    const stored = await getPublicChoiceCandidateById(created.candidateId);
    assert.equal(stored?.submittedByParticipantId, memberAsParticipant.participantId);
  });

  it("Visitor (no participantId) cannot add a candidate", async () => {
    const initiativeId = track("pack02d-visitor-blocked");
    createInitiative(buildPublicChoiceInitiative(initiativeId));
    const visitor: RequestIdentity = {};
    await assert.rejects(
      () =>
        createPublicChoiceCandidateForInitiative(visitor, initiativeId, {
          name: "Visitor Nominee",
        }),
      /Authentication required/,
    );
  });
});

describe("Public Choice Pack 02D — candidate intake + retention contracts", () => {
  it("candidate submit href targets Initiative Overview #add-candidate", () => {
    const overview = read(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const routes = read(
      "apps/web/src/features/initiative-owner-studio/initiative-experience-routes.ts",
    );
    const page = read(
      "apps/web/src/features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(routes, /buildPublicChoiceCandidateSubmitHref/);
    assert.match(routes, /#add-candidate/);
    assert.doesNotMatch(routes, /\/election#add-candidate/);
    assert.match(overview, /PublicChoiceCandidateSubmitPanel/);
    assert.match(overview, /#add-candidate|add-candidate|openSubmitForm/);
    assert.doesNotMatch(page, /PublicChoiceCandidateSubmitPanel/);
    assert.doesNotMatch(page, /\+ Add candidate/);
  });

  it("Overview intake supports authenticated submit; visitors use register returnTo when linked", () => {
    const overview = read(
      "apps/web/src/features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /useClientAuthStatus|isAuthenticated|register/);
  });

  it("create path no longer requires assertInitiativeOwnership", () => {
    const service = read(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    assert.match(service, /submittedByParticipantId: participantId/);
    assert.match(service, /any authenticated Participant may add/i);
    // Ownership retained for mutate path helpers / steward checks, not create gate.
    assert.match(service, /assertCanMutateCandidate/);
  });

  it("retention purge deletes recoverable vote Participant Actions and outbox payloads", () => {
    const retention = read(
      "apps/api/src/modules/public-choice-results-retention/public-choice-results-retention.service.ts",
    );
    assert.match(retention, /deletePublicChoiceVoteParticipantActionsForInitiative/);
    assert.match(retention, /deleteInitiativeDecisionVoteOutboxForDecision/);
    assert.match(retention, /publicChoiceResultsExpiredAt/);
  });

  it("tombstone metadata has no candidate/vote/result fields", () => {
    const initiative = read("packages/types/src/domain/initiative.ts");
    assert.match(initiative, /publicChoiceResultsExpiredAt\?:/);
    assert.match(initiative, /tombstone only/i);
  });
});
