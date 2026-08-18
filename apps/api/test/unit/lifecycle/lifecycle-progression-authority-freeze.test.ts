import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  INITIATIVE_LIFECYCLE_FIELD_AUTHORITY,
  resolveInitiativeLifecycleState,
} from "@hu/types";

import { buildPipelineStatus } from "../../../src/modules/capability02-integration/capability02-integration.service.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";
import {
  assertFieldIsNotCanonicalProgressAuthority,
  describeCanonicalLifecycleProgressionAuthority,
  LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES,
  resolveCanonicalCurrentStageId,
} from "../../../src/shared/lifecycle/lifecycle-progression-authority.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("Lifecycle progression authority freeze", () => {
  it("documents canonical authority and disconnected competitors", () => {
    assert.match(describeCanonicalLifecycleProgressionAuthority(), /resolveInitiativeLifecycleState/);
    assert.ok(
      LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES.includes("capability02.buildPipelineStatus"),
    );
    assert.equal(
      INITIATIVE_LIFECYCLE_FIELD_AUTHORITY.capability02PipelineStatus,
      "COMPATIBILITY_DISPLAY_ONLY",
    );
    assert.equal(
      INITIATIVE_LIFECYCLE_FIELD_AUTHORITY.initiativeStatus,
      "LEGACY_DO_NOT_USE_FOR_PROGRESS",
    );
    assert.equal(
      INITIATIVE_LIFECYCLE_FIELD_AUTHORITY.frontendActiveStageHash,
      "DISPLAY_ONLY",
    );
    assert.doesNotThrow(() =>
      assertFieldIsNotCanonicalProgressAuthority("capability02PipelineStatus"),
    );
    assert.throws(() => assertFieldIsNotCanonicalProgressAuthority("publishedLifecycleArtifacts"));
  });

  it("comment / proposal / reaction counts do not advance Lifecycle", () => {
    const withoutEngagement = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
      },
    });
    const withHugeEngagement = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        // Engagement metrics are not stage keys — inventing tallies must not move progress.
        comments: 10_000,
        proposals: 10_000,
        reactions: 10_000,
        likes: 10_000,
        allies: 10_000,
      },
    });

    assert.equal(withoutEngagement.currentStageId, "analysis");
    assert.equal(withHugeEngagement.currentStageId, "analysis");
    assert.deepEqual(withoutEngagement.completedStageIds, withHugeEngagement.completedStageIds);
  });

  it("zero community data does not block Author progression past Discussion", () => {
    // Author completed Discussion with zero comments — only the completion
    // artifact count matters.
    const state = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
      },
    });
    assert.equal(state, "analysis");

    const afterAnalysisPublish = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
      },
    });
    assert.equal(afterAnalysisPublish, "proposal");
  });

  it("legacy Cap02 pipeline status cannot change experience currentStageId", () => {
    const initiative = {
      initiativeId: "authority-freeze-1",
      status: "proposal",
      lifecyclePhase: "published",
      lifecycleProfile: "STANDARD",
    } as never;

    const records = new Map([
      ["initiative", [{ recordId: "i1", title: "T", updatedAt: "2026-01-01T00:00:00.000Z" }]],
      ["discussion", [{ recordId: "d1", title: "D", updatedAt: "2026-01-02T00:00:00.000Z" }]],
      ["analysis", []],
    ]);

    const nav = buildLifecycleNavigation(initiative, records);
    assert.equal(nav.currentStageId, "analysis");

    // Cap02 may report a different "current" cursor for widgets — that must
    // not be wired into navigation (and must declare compatibility authority).
    const cap02 = buildPipelineStatus("authority-freeze-1");
    assert.equal(cap02.progressionAuthority, "compatibility_display_only");
    assert.notEqual(cap02.currentStageId, nav.currentStageId);

    // Re-deriving nav after Cap02 call is unchanged.
    const navAgain = buildLifecycleNavigation(initiative, records);
    assert.equal(navAgain.currentStageId, "analysis");
  });

  it("Initiative.status label cannot change canonical currentStageId", () => {
    const counts = { initiative: 1, discussion: 1, analysis: 1 } as const;
    const asProposalLabel = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: counts,
    });
    // Status is not an input — same counts always yield same stage.
    assert.equal(asProposalLabel, "proposal");
    assert.equal(
      resolveInitiativeLifecycleState({
        lifecycleProfile: "STANDARD",
        publishedStageCounts: counts,
      }).currentStageId,
      "proposal",
    );
  });

  it("frontend/hash state cannot change progression", () => {
    const counts = { initiative: 1, discussion: 1 } as const;
    const before = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: counts,
    });

    // Simulate hash selection of a future stage — progression inputs unchanged.
    const hashSelectedStageId = "petition";
    void hashSelectedStageId;

    const after = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: counts,
    });
    assert.equal(before, "analysis");
    assert.equal(after, "analysis");
    assert.equal(INITIATIVE_LIFECYCLE_FIELD_AUTHORITY.frontendActiveStageHash, "DISPLAY_ONLY");
  });

  it("canonical experience nav module does not import Cap02 or legacy quorum helpers", () => {
    const navSource = readFileSync(
      path.resolve(
        HERE,
        "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.ts",
      ),
      "utf8",
    );
    const experienceSource = readFileSync(
      path.resolve(HERE, "../../../src/modules/initiatives/public-initiative-experience.service.ts"),
      "utf8",
    );
    const stateSource = readFileSync(
      path.resolve(HERE, "../../../../../packages/types/src/domain/initiative-lifecycle-state.ts"),
      "utf8",
    );

    for (const source of [navSource, experienceSource, stateSource]) {
      assert.doesNotMatch(source, /capability02-integration/);
      assert.doesNotMatch(source, /collective-decision\.helpers/);
      assert.doesNotMatch(source, /collaborative-analysis\.store/);
      assert.doesNotMatch(source, /implementation-commitment\.store/);
    }

    assert.match(navSource, /AUTHORITY FREEZE/);
  });
});
