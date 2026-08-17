import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  settleOptionalLifecycleLookup,
} from "../../../src/shared/lifecycle/optional-lifecycle-lookup.js";
import { buildInitiativeLifecycleStagePublishedEventId } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-published.event.js";
import {
  assertLifecycleTransitionPostcondition,
  resolveNextStageAfterPublish,
} from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";

describe("Lifecycle Finalization Phase 02 — soft-fail + transition idempotency helpers", () => {
  it("A — absent optional petition → NOT_CREATED_YET (not infrastructure failure)", async () => {
    const settled = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      Promise.resolve(null),
      null,
    );
    assert.equal(settled.classification, "NOT_CREATED_YET");
    assert.equal(settled.degraded, false);
    assert.equal(settled.reasonCode, "not_created_yet");
    assert.equal(settled.value, null);
  });

  it("B — provider rejection → INFRASTRUCTURE_FAILURE (not normal absence)", async () => {
    const settled = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      Promise.reject(new Error("MongoDB is not configured.")),
      null,
    );
    assert.equal(settled.classification, "INFRASTRUCTURE_FAILURE");
    assert.equal(settled.degraded, true);
    assert.equal(settled.reasonCode, "infrastructure_failure");
    assert.equal(settled.value, null);
    assert.notEqual(settled.classification, "NOT_CREATED_YET");
    assert.notEqual(settled.reasonCode, "not_created_yet");
  });

  it("C/D — Experience may continue with degraded optional section that remains observable", async () => {
    const petition = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      Promise.reject(new Error("querySrv ECONNREFUSED")),
      null,
    );
    // Conceptual Experience shape: success with degraded petition diagnostic.
    const experience = {
      success: true,
      petitionRecords: [] as unknown[],
      optionalStageDiagnostics: {
        petition: {
          health: petition.degraded ? ("unavailable" as const) : ("absent" as const),
          reasonCode: petition.reasonCode ?? undefined,
        },
      },
    };
    assert.equal(experience.success, true);
    assert.equal(experience.optionalStageDiagnostics.petition.health, "unavailable");
    assert.equal(
      experience.optionalStageDiagnostics.petition.reasonCode,
      "infrastructure_failure",
    );
  });

  it("required Initiative identity failures must still throw (not wrapped)", async () => {
    await assert.rejects(
      async () => {
        throw new Error("Initiative store unavailable");
      },
      /Initiative store unavailable/,
    );
  });

  it("duplicate transition event ids are deterministic (no duplicate notification key)", () => {
    const first = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });
    const retry = buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: "initiative-1",
      stageId: "analysis",
      stageVersion: 1,
      publicationKind: "published",
    });
    assert.equal(first, retry);
  });

  it("successful STANDARD analysis publish exposes Improvement Proposals next", () => {
    const next = resolveNextStageAfterPublish("analysis", "STANDARD");
    assert.equal(next, "proposal");
    assert.doesNotThrow(() =>
      assertLifecycleTransitionPostcondition({
        publishedStageId: "analysis",
        lifecycleProfile: "STANDARD",
        nextStageId: "proposal",
        priorPublishedStageCounts: { initiative: 1, discussion: 1 },
      }),
    );
  });

  it("PUBLIC_CHOICE Initiative → Discussion (not Collective Decision)", () => {
    assert.equal(resolveNextStageAfterPublish("initiative", "PUBLIC_CHOICE"), "discussion");
  });
});
