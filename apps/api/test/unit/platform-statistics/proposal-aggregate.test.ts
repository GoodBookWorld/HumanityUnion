import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { InitiativeImprovementProposal } from "@hu/types";

import { disconnectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import {
  countPublicImprovementProposals,
  createProposal,
  deleteProposalsByAuthorIdForTests,
  updateProposal,
} from "../../../src/modules/initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { clearPlatformStatisticsCache } from "../../../src/modules/platform-statistics/platform-statistics.cache.js";
import { getPlatformStatisticsPayload } from "../../../src/modules/platform-statistics/platform-statistics.service.js";

const TEST_AUTHOR = "pack04-proposal-aggregate-author";

function buildProposal(
  overrides: Partial<InitiativeImprovementProposal> &
    Pick<InitiativeImprovementProposal, "proposalId" | "status">,
): InitiativeImprovementProposal {
  const now = new Date().toISOString();
  return {
    initiativeId: "initiative-pack04-aggregate",
    analysisId: "analysis-pack04-aggregate",
    authorId: TEST_AUTHOR,
    targetSection: "Section",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "Refs",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Admin Panel Pack 04 — canonical Proposal aggregate", () => {
  after(async () => {
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    clearPlatformStatisticsCache();
    await disconnectMongoClient();
  });

  it("counts only submitted and decided public statuses (excludes draft/archived)", () => {
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    const baseline = countPublicImprovementProposals();

    createProposal(buildProposal({ proposalId: "pack04-draft", status: "draft" }));
    createProposal(buildProposal({ proposalId: "pack04-archived", status: "archived" }));
    assert.equal(countPublicImprovementProposals(), baseline);

    createProposal(buildProposal({ proposalId: "pack04-submitted", status: "submitted" }));
    createProposal(buildProposal({ proposalId: "pack04-accepted", status: "accepted" }));
    createProposal(
      buildProposal({ proposalId: "pack04-partial", status: "partially_accepted" }),
    );
    createProposal(buildProposal({ proposalId: "pack04-declined", status: "declined" }));

    assert.equal(countPublicImprovementProposals(), baseline + 4);

    updateProposal("pack04-submitted", { status: "archived" });
    assert.equal(countPublicImprovementProposals(), baseline + 3);

    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    assert.equal(countPublicImprovementProposals(), baseline);
  });

  it("does not treat revision linkage as an extra Proposal", () => {
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    const baseline = countPublicImprovementProposals();

    createProposal(
      buildProposal({
        proposalId: "pack04-with-revision",
        status: "accepted",
        implementedInRevisionId: "revision-1",
        implementedInVersion: 2,
      }),
    );

    assert.equal(countPublicImprovementProposals(), baseline + 1);
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
  });

  it("exposes proposals on live-computed platform statistics payload", async () => {
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    clearPlatformStatisticsCache();

    const empty = await getPlatformStatisticsPayload();
    assert.equal(typeof empty.data.proposals, "number");
    assert.equal(typeof empty.data.authors, "number");
    assert.ok(empty.data.proposals >= 0);
    assert.ok(empty.data.authors >= 0);

    const baseline = empty.data.proposals;

    createProposal(buildProposal({ proposalId: "pack04-stats-a", status: "submitted" }));
    createProposal(buildProposal({ proposalId: "pack04-stats-b", status: "accepted" }));
    createProposal(buildProposal({ proposalId: "pack04-stats-draft", status: "draft" }));

    clearPlatformStatisticsCache();
    const withProposals = await getPlatformStatisticsPayload();
    assert.equal(withProposals.data.proposals, baseline + 2);

    deleteProposalsByAuthorIdForTests(TEST_AUTHOR);
    clearPlatformStatisticsCache();
  });
});
