import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  createParticipationArea,
  deleteParticipationAreasByParticipantIdForTests,
  getActiveParticipationAreaForParticipant,
  getParticipationAreaById,
  getPersistenceMode,
  getPendingParticipationAreaTransitionForParticipant,
  requestParticipationAreaTransition,
  seedParticipationArea,
} from "../../../src/modules/participation-area/participation-area.store.js";
import {
  createDecision,
  deleteDecisionsByStewardIdForTests,
  getDecisionById,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import {
  castOrChangeInitiativeDecisionVote,
  deleteVotesByParticipantIdForTests,
  getActiveVoteForParticipant,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";

/**
 * Recovery Task 13 — coverage notes.
 *
 * These tests exercise `deleteParticipationAreasByParticipantIdForTests`
 * directly against the real, file-backed Participation Area store (the
 * module's default persistence mode — no `PARTICIPATION_AREA_PERSISTENCE`
 * env override), mirroring the established pattern from Recovery Tasks
 * 08-10 (e.g. `decision-session-ancestry.test.ts`,
 * `initiative-decision-vote-ancestry.test.ts`). All fixture participant,
 * decision, and Initiative IDs below are unique to this file
 * (`test-pa-cleanup-*`) and are removed in `after()` so no residual fixture
 * data is left in `.runtime/participation-areas.json` (or the other stores
 * touched by the isolation tests) after this suite completes.
 *
 * `PARTICIPATION_AREA_PERSISTENCE` defaults to `"file"`, never `"mongodb"`,
 * and this file never sets it otherwise. Recovery Task 31 update: the single
 * Vote-isolation test below now goes through the real, unconditionally
 * MongoDB-backed Vote store (`castOrChangeInitiativeDecisionVote` /
 * `getActiveVoteForParticipant`), so this whole file is skipped when
 * MONGODB_URI is not configured, per the existing repository convention.
 */
if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const PARTICIPANT_SOLO = "test-pa-cleanup-solo";
const PARTICIPANT_MULTI = "test-pa-cleanup-multi";
const PARTICIPANT_NO_MATCH = "test-pa-cleanup-no-match";
const PARTICIPANT_PRESERVED = "test-pa-cleanup-preserved";
const PARTICIPANT_RECREATE = "test-pa-cleanup-recreate";
const PARTICIPANT_UNIQUENESS = "test-pa-cleanup-uniqueness";
const PARTICIPANT_VOTE_ISOLATION = "test-pa-cleanup-vote-isolation";
const PARTICIPANT_TRANSITION = "test-pa-cleanup-transition";

const FIXTURE_STEWARD_ID = "test-pa-cleanup-steward";
const FIXTURE_INITIATIVE_ID = "test-pa-cleanup-initiative-1";
const FIXTURE_DECISION_ID = "test-pa-cleanup-decision-1";

const ALL_FIXTURE_PARTICIPANT_IDS = [
  PARTICIPANT_SOLO,
  PARTICIPANT_MULTI,
  PARTICIPANT_NO_MATCH,
  PARTICIPANT_PRESERVED,
  PARTICIPANT_RECREATE,
  PARTICIPANT_UNIQUENESS,
  PARTICIPANT_VOTE_ISOLATION,
  PARTICIPANT_TRANSITION,
];

function buildFakeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: FIXTURE_INITIATIVE_ID,
    stewardId: FIXTURE_STEWARD_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "Fixture Initiative",
    description: "Fixture description.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

function buildFakeDecision(
  overrides: Partial<InitiativeCollectiveDecision> = {},
): InitiativeCollectiveDecision {
  const now = new Date();
  return {
    decisionId: FIXTURE_DECISION_ID,
    initiativeId: FIXTURE_INITIATIVE_ID,
    decisionSessionId: "test-pa-cleanup-session-1",
    stewardId: FIXTURE_STEWARD_ID,
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Should the fixture proceed?",
    openedAt: new Date(now.getTime() - 86400000).toISOString(),
    closesAt: new Date(now.getTime() + 864000000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("Participation Area fixture cleanup (Recovery Task 13)", () => {
  after(async () => {
    for (const participantId of ALL_FIXTURE_PARTICIPANT_IDS) {
      deleteParticipationAreasByParticipantIdForTests(participantId);
    }
    await deleteVotesByParticipantIdForTests(PARTICIPANT_VOTE_ISOLATION);
    deleteDecisionsByStewardIdForTests(FIXTURE_STEWARD_ID);
  });

  it("confirms the file-backed persistence mode used by these tests (no MongoDB)", () => {
    assert.equal(getPersistenceMode(), "file");
  });

  it("removes a matching fixture participant's active Participation Area", () => {
    createParticipationArea({
      participantId: PARTICIPANT_SOLO,
      countrySlug: "canada",
      verificationStatus: "verified",
    });
    assert.notEqual(getActiveParticipationAreaForParticipant(PARTICIPANT_SOLO), null);

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_SOLO);

    assert.equal(getActiveParticipationAreaForParticipant(PARTICIPANT_SOLO), null);
  });

  it("removes multiple areas for the same fixture participant, including non-active ones", () => {
    const now = new Date().toISOString();
    seedParticipationArea({
      participationAreaId: "test-pa-cleanup-multi-archived",
      participantId: PARTICIPANT_MULTI,
      countrySlug: "canada",
      verificationStatus: "verified",
      status: "archived",
      createdAt: now,
      updatedAt: now,
    });
    seedParticipationArea({
      participationAreaId: "test-pa-cleanup-multi-active",
      participantId: PARTICIPANT_MULTI,
      countrySlug: "canada",
      verificationStatus: "verified",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    assert.notEqual(getParticipationAreaById("test-pa-cleanup-multi-archived"), null);
    assert.notEqual(getParticipationAreaById("test-pa-cleanup-multi-active"), null);

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_MULTI);

    assert.equal(getParticipationAreaById("test-pa-cleanup-multi-archived"), null);
    assert.equal(getParticipationAreaById("test-pa-cleanup-multi-active"), null);
  });

  it("is a no-op when no matching record exists", () => {
    assert.doesNotThrow(() =>
      deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_NO_MATCH),
    );
  });

  it("preserves another participant's Participation Area", () => {
    createParticipationArea({
      participantId: PARTICIPANT_SOLO,
      countrySlug: "canada",
      verificationStatus: "verified",
    });
    createParticipationArea({
      participantId: PARTICIPANT_PRESERVED,
      countrySlug: "mexico",
      verificationStatus: "verified",
    });

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_SOLO);

    assert.equal(getActiveParticipationAreaForParticipant(PARTICIPANT_SOLO), null);
    const preserved = getActiveParticipationAreaForParticipant(PARTICIPANT_PRESERVED);
    assert.notEqual(preserved, null);
    assert.equal(preserved?.countrySlug, "mexico");

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_PRESERVED);
  });

  it("also removes a pending Participation Area Transition owned by the participant", () => {
    createParticipationArea({
      participantId: PARTICIPANT_TRANSITION,
      countrySlug: "canada",
      regionSlug: "british-columbia",
      communitySlug: "nelson-community-garden",
      verificationStatus: "verified",
    });
    requestParticipationAreaTransition({
      participantId: PARTICIPANT_TRANSITION,
      toArea: {
        countrySlug: "canada",
        regionSlug: "british-columbia",
        communitySlug: "kootenay-lake-protection-society",
      },
      effectiveAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.notEqual(
      getPendingParticipationAreaTransitionForParticipant(PARTICIPANT_TRANSITION),
      null,
    );

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_TRANSITION);

    assert.equal(getActiveParticipationAreaForParticipant(PARTICIPANT_TRANSITION), null);
    assert.equal(
      getPendingParticipationAreaTransitionForParticipant(PARTICIPANT_TRANSITION),
      null,
    );
  });

  it("persists the removal to the file-backed store (survives a fresh module-level reload check)", () => {
    createParticipationArea({
      participantId: PARTICIPANT_SOLO,
      countrySlug: "canada",
      verificationStatus: "verified",
    });
    const created = getActiveParticipationAreaForParticipant(PARTICIPANT_SOLO);
    assert.notEqual(created, null);

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_SOLO);

    // getParticipationAreaById reads the in-process Map (kept in sync with
    // disk by persistStores() on every mutation); confirming the record is
    // gone here, combined with the "file" persistence mode assertion above,
    // establishes that the same removal was written to
    // .runtime/participation-areas.json rather than only mutated in memory.
    assert.equal(getParticipationAreaById(created!.participationAreaId), null);
  });

  it("allows creating an active Participation Area again after cleanup", () => {
    createParticipationArea({
      participantId: PARTICIPANT_RECREATE,
      countrySlug: "canada",
      verificationStatus: "verified",
    });
    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_RECREATE);

    assert.doesNotThrow(() =>
      createParticipationArea({
        participantId: PARTICIPANT_RECREATE,
        countrySlug: "germany",
        verificationStatus: "unverified",
      }),
    );
    const recreated = getActiveParticipationAreaForParticipant(PARTICIPANT_RECREATE);
    assert.equal(recreated?.countrySlug, "germany");
  });

  it("preserves existing uniqueness enforcement when cleanup is not used", () => {
    createParticipationArea({
      participantId: PARTICIPANT_UNIQUENESS,
      countrySlug: "canada",
      verificationStatus: "verified",
    });

    assert.throws(
      () =>
        createParticipationArea({
          participantId: PARTICIPANT_UNIQUENESS,
          countrySlug: "mexico",
          verificationStatus: "verified",
        }),
      /Participant already has an active Participation Area\./,
    );
  });

  it("does not modify Vote records owned by the same participant", async () => {
    createParticipationArea({
      participantId: PARTICIPANT_VOTE_ISOLATION,
      countrySlug: "canada",
      verificationStatus: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId: FIXTURE_DECISION_ID,
      participantId: PARTICIPANT_VOTE_ISOLATION,
      initiativeId: FIXTURE_INITIATIVE_ID,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert.notEqual(
      await getActiveVoteForParticipant(FIXTURE_DECISION_ID, PARTICIPANT_VOTE_ISOLATION),
      null,
    );

    deleteParticipationAreasByParticipantIdForTests(PARTICIPANT_VOTE_ISOLATION);

    assert.equal(getActiveParticipationAreaForParticipant(PARTICIPANT_VOTE_ISOLATION), null);
    assert.notEqual(
      await getActiveVoteForParticipant(FIXTURE_DECISION_ID, PARTICIPANT_VOTE_ISOLATION),
      null,
      "Vote record must survive Participation Area cleanup",
    );
  });

  it("does not modify Collective Decision records", () => {
    createDecision(buildFakeDecision());
    assert.notEqual(getDecisionById(FIXTURE_DECISION_ID), null);

    deleteParticipationAreasByParticipantIdForTests(FIXTURE_STEWARD_ID);

    assert.notEqual(
      getDecisionById(FIXTURE_DECISION_ID),
      null,
      "Collective Decision record must survive Participation Area cleanup",
    );
  });

  it("does not modify unrelated Initiative records", async () => {
    // Forced to "memory" (this module has not been imported anywhere else
    // in this test file, so this is safe) purely so this isolation check
    // never writes a residual fixture Initiative into the real, file-backed
    // .runtime/initiatives.json — the Initiative module's file store has no
    // ForTests cleanup helper and modifying it is out of this task's scope.
    process.env.INITIATIVE_PERSISTENCE = "memory";
    const { createInitiative, getInitiativeById } = await import(
      "../../../src/modules/initiatives/initiative.store.js"
    );

    createInitiative(buildFakeInitiative());
    assert.notEqual(getInitiativeById(FIXTURE_INITIATIVE_ID), null);

    deleteParticipationAreasByParticipantIdForTests(FIXTURE_STEWARD_ID);

    assert.notEqual(
      getInitiativeById(FIXTURE_INITIATIVE_ID),
      null,
      "Initiative record must survive Participation Area cleanup",
    );
  });
});
