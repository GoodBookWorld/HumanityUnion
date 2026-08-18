process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=1&connectTimeoutMS=1";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

const { assessDecisionSessionEligibilityForInitiative } = await import(
  "../../../src/modules/decision-session/decision-session-eligibility.js"
);
const { createCollection } = await import(
  "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js"
);

function baseInitiative(initiativeId: string): Initiative {
  return {
    initiativeId,
    stewardId: "steward-1",
    title: "Eligibility fixture",
    description: "Fixture",
    communitySlug: "fixture",
    activityArea: "Environment",
    status: "projected",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Initiative;
}

describe("Final Certification Fix 01 — Decision Session zero-proposal eligibility", () => {
  it("blocks when zero proposals and Improvement Proposals stage is not completed", async () => {
    const eligibility = await assessDecisionSessionEligibilityForInitiative(
      baseInitiative(`initiative-ds-block-${Date.now()}`),
    );

    assert.equal(eligibility.eligible, false);
    assert.ok(
      eligibility.reasons.some(
        (reason) =>
          reason.includes("steward-reviewed improvement proposal") ||
          reason.includes("Improvement Proposals stage"),
      ),
    );
  });

  it("clears proposal blocker when Improvement Proposals stage is explicitly completed with zero proposals", async () => {
    const initiativeId = `initiative-ds-zero-complete-${Date.now()}`;
    const now = new Date().toISOString();

    await createCollection({
      collectionId: `collection-${initiativeId}`,
      initiativeId,
      authorId: "steward-1",
      analysisId: null,
      status: "published",
      proposals: [],
      sourceSnapshotCreatedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const eligibility = await assessDecisionSessionEligibilityForInitiative(
      baseInitiative(initiativeId),
    );

    assert.equal(
      eligibility.reasons.some((reason) => reason.includes("improvement proposal")),
      false,
      `proposal blocker should be cleared, got: ${eligibility.reasons.join(" | ")}`,
    );
  });
});
