/**
 * Public Choice Fix 06 — runtime data path: ensure election decision + public roster.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative } from "@hu/types";
import { resolvePublicChoiceElectionVotingStatus } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  ensurePublicChoiceElectionVotingDecision,
  resolvePublicChoiceElectionVotingWindow,
} from "../../../src/modules/initiative-collective-decision/ensure-public-choice-election-decision.js";
import { deleteDecisionsByStewardIdForTests } from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import { listDecisionsByInitiative } from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import { createPublicChoiceCandidateForInitiative } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { computePublicChoiceBallotAggregatesForDecision } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import { aggregateSelectOneVotes } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-ballot-aggregates.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(dir, "../../../src");
const webRoot = path.resolve(dir, "../../../../web/src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `fix06-steward-${testRunId}` };
const trackedInitiativeIds: string[] = [];

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function buildPublicChoiceInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Fix 06 Staging-shaped Election",
    description: "Compatibility election",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "PUBLIC_CHOICE",
    visibility: { policy: "public" },
    metadata: {
      category: "",
      tags: [],
      region: "",
      language: "en",
      communityAssociation: "Community Mayor Election — Staging Test",
      ballotMode: "SELECT_ONE_CANDIDATE",
      startDate: "2026-08-19T00:00:00.000Z",
      completionDate: "2026-09-19T00:00:00.000Z",
    },
    timeline: [],
    revisions: [],
    contributions: [],
  };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  deleteDecisionsByStewardIdForTests(steward.participantId);
  for (const initiativeId of trackedInitiativeIds) {
    await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    try {
      deleteInitiative(initiativeId);
    } catch {
      // ignore
    }
  }
});

describe("Public Choice Fix 06 — ensure election decision", () => {
  it("creates opened decision from startDate/completionDate for elections with no decision", () => {
    const initiativeId = `initiative-fix06-${testRunId}`;
    trackedInitiativeIds.push(initiativeId);
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    assert.equal(listDecisionsByInitiative(initiativeId).length, 0);

    const decision = ensurePublicChoiceElectionVotingDecision(
      initiativeId,
      "2026-08-21T12:00:00.000Z",
    );
    assert.ok(decision);
    assert.equal(decision!.status, "opened");
    assert.equal(decision!.openedAt, "2026-08-19T00:00:00.000Z");
    assert.equal(decision!.closesAt, "2026-09-19T00:00:00.000Z");
    assert.equal(decision!.decisionSessionId, null);

    const status = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: decision!.status,
      openedAt: decision!.openedAt,
      closesAt: decision!.closesAt,
      nowIso: "2026-08-21T12:00:00.000Z",
    });
    assert.equal(status, "OPEN");

    const again = ensurePublicChoiceElectionVotingDecision(initiativeId);
    assert.equal(again?.decisionId, decision!.decisionId);
  });

  it("legacy missing ballotMode still resolves voting window from Initiative dates", () => {
    const initiative = buildPublicChoiceInitiative(`initiative-fix06-legacy-${testRunId}`);
    delete (initiative.metadata as { ballotMode?: string }).ballotMode;
    const window = resolvePublicChoiceElectionVotingWindow(initiative, "2026-08-21T00:00:00.000Z");
    assert.equal(window.openedAt, "2026-08-19T00:00:00.000Z");
    assert.equal(window.closesAt, "2026-09-19T00:00:00.000Z");
  });
});

describe("Public Choice Fix 06 — zero-vote aggregates", () => {
  it("candidates present + zero votes → SELECT_ONE rows at 0", async () => {
    const initiativeId = `initiative-fix06-zero-${testRunId}`;
    trackedInitiativeIds.push(initiativeId);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);

    const a = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
    });
    const b = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate B",
    });

    const decision = ensurePublicChoiceElectionVotingDecision(
      initiativeId,
      "2026-08-21T12:00:00.000Z",
    );
    assert.ok(decision);

    const aggregates = await computePublicChoiceBallotAggregatesForDecision(
      decision!.decisionId,
      initiative,
    );
    assert.equal(aggregates.ballotMode, "SELECT_ONE_CANDIDATE");
    if (aggregates.ballotMode !== "SELECT_ONE_CANDIDATE") {
      return;
    }
    assert.equal(aggregates.totalEffectiveVoters, 0);
    assert.equal(aggregates.candidates.length, 2);
    assert.ok(aggregates.candidates.every((row) => row.count === 0 && row.percentage === 0));
    assert.ok(aggregates.candidates.some((row) => row.candidateId === a.candidateId));
    assert.ok(aggregates.candidates.some((row) => row.candidateId === b.candidateId));

    const pure = aggregateSelectOneVotes([], [a.candidateId, b.candidateId]);
    assert.equal(pure.candidates.length, 2);
  });
});

describe("Public Choice Fix 06 — wiring contracts", () => {
  it("publishInitiative ensures PUBLIC_CHOICE decision; public candidates route exists", () => {
    const publish = readApi("modules/initiatives/initiative.service.ts");
    const app = readApi("app.ts");
    const webApi = readWeb("features/public-choice-candidate/api.ts");
    assert.match(publish, /ensurePublicChoiceElectionVotingDecision/);
    assert.match(app, /publicChoiceCandidatesByInitiativeRouter/);
    assert.match(webApi, /\/api\/v1\/public\/initiatives\/.*\/candidates/);
  });

  it("Overview no longer fails entirely when decisions list errors", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /listPublicInitiativeCollectiveDecisions\(initiativeId\)\.catch/);
    assert.match(overview, /listPublicChoiceCandidates\(initiativeId\)\.catch/);
  });
});
