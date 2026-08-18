import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { assessDecisionSessionEligibilityForInitiative } from "../../../src/modules/decision-session/decision-session-eligibility.js";
import { createCollection } from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";

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
