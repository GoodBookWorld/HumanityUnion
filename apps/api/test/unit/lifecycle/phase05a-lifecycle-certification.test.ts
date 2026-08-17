import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterLifecycleProgressRevisions,
  isLifecycleProgressRevision,
} from "../../../src/shared/lifecycle/lifecycle-progress-revision.js";
import {
  assertLifecycleStageTruthConsistent,
  detectLifecycleStageTruthContradiction,
  LifecyclePresentationContradictionError,
} from "../../../src/shared/lifecycle/lifecycle-presentation-invariants.js";
import { isPetitionPubliclyVisible } from "../../../src/modules/petition/petition-public-visibility.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";
import type { Initiative, PublicInitiativeLifecycleRecordItem } from "@hu/types";

describe("lifecycle progress revision filter", () => {
  it("excludes bootstrap initial Initiative version from progress", () => {
    assert.equal(
      isLifecycleProgressRevision({
        version: 1,
        revisionSummary: "Initial published version.",
        changes: [],
      }),
      false,
    );
  });

  it("counts Author revision publications", () => {
    assert.equal(
      isLifecycleProgressRevision({
        version: 2,
        revisionSummary: "Incorporated accepted proposals.",
        changes: [{ changeId: "c1" }],
      }),
      true,
    );
    assert.equal(
      isLifecycleProgressRevision({
        version: 1,
        revisionSummary: "Author revised title before proposals.",
        changes: [{ changeId: "c1" }],
      }),
      true,
    );
  });

  it("keeps only progress revisions in filter", () => {
    const filtered = filterLifecycleProgressRevisions([
      { version: 1, revisionSummary: "Initial published version.", changes: [], revisionId: "a" },
      { version: 2, revisionSummary: "Revised", changes: [{}], revisionId: "b" },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.revisionId, "b");
  });
});

describe("petition public visibility", () => {
  it("treats Draft and Ready as not public", () => {
    assert.equal(isPetitionPubliclyVisible("Draft"), false);
    assert.equal(isPetitionPubliclyVisible("Ready"), false);
  });

  it("treats Published/Open/Closed/Archived as public", () => {
    for (const status of ["Published", "Open", "Closed", "Archived"] as const) {
      assert.equal(isPetitionPubliclyVisible(status), true);
    }
  });
});

describe("lifecycle presentation invariants", () => {
  it("detects published + not_started contradiction", () => {
    const message = detectLifecycleStageTruthContradiction({
      stageId: "petition",
      presentationStatus: "not_started",
      authorReportsAlreadyPublished: true,
    });
    assert.match(message ?? "", /not_started simultaneously/);
  });

  it("detects published + unavailable contradiction", () => {
    assert.throws(
      () =>
        assertLifecycleStageTruthConsistent({
          stageId: "petition",
          presentationStatus: "unavailable",
          hasPublishedArtifact: true,
        }),
      LifecyclePresentationContradictionError,
    );
  });

  it("allows not_started alone and published alone", () => {
    assert.equal(
      detectLifecycleStageTruthContradiction({
        stageId: "petition",
        presentationStatus: "not_started",
      }),
      null,
    );
    assert.equal(
      detectLifecycleStageTruthContradiction({
        stageId: "petition",
        presentationStatus: "published",
        hasPublishedArtifact: true,
      }),
      null,
    );
  });
});

describe("bootstrap revision must not jump STANDARD current stage", () => {
  it("keeps current at discussion when only initiative + bootstrap revision exist", () => {
    const initiative = {
      initiativeId: "init-1",
      lifecycleProfile: "STANDARD",
    } as Initiative;

    const records = new Map<string, PublicInitiativeLifecycleRecordItem[]>([
      ["initiative", [{ recordId: "init-1", title: "T", updatedAt: "2026-01-01T00:00:00.000Z" }]],
      // Bootstrap revision must NOT be present in lifecycle progress records.
      ["revision", []],
    ]);

    const nav = buildLifecycleNavigation(initiative, records);
    assert.equal(nav.currentStageId, "discussion");
    const analysis = nav.stages.find((stage) => stage.stageId === "analysis");
    assert.equal(analysis?.state, "not_started");
  });
});
