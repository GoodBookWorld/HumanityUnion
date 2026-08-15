import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { buildLifecycleAiProviderContext } from "../../../src/modules/lifecycle-ai/build-lifecycle-ai-provider-context.js";
import { assertLifecycleAiPayloadIsPrivateFree } from "../../../src/modules/lifecycle-ai/lifecycle-ai-privacy.js";

const initiative = {
  initiativeId: "initiative-privacy-1",
  stewardId: "member-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  title: "Privacy Boundary Initiative",
  description: "Public civic description only.",
  status: "proposal",
  lifecyclePhase: "published",
  visibility: { policy: "public" },
  metadata: {
    category: "Community",
    tags: [],
    region: "Test",
    language: "en",
    communitySlug: "test",
    activityArea: "Environment",
  },
  revisions: [],
  contributions: [],
  timeline: [],
} as Initiative;

describe("Lifecycle AI privacy context boundary", () => {
  it("builds only allow-listed civic fields server-side", async () => {
    const context = await buildLifecycleAiProviderContext({
      identity: { participantId: "member-1", displayName: "Alex Author" },
      initiative,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      presentationMode: "author_workspace",
      operation: "explain",
      instructions: "What is an Active Ally?",
    });

    assert.deepEqual(
      [...context.includedFields].sort(),
      [
        "availableSourceLabels",
        "initiativeId",
        "initiativeTitle",
        "instructions",
        "operation",
        "participantDisplayName",
        "presentationMode",
        "sourceContextSummary",
        "stageId",
        "stageLabel",
      ].sort(),
    );

    const serialized = JSON.stringify(context).toLowerCase();
    assert.equal(serialized.includes("directmessage"), false);
    assert.equal(serialized.includes("password"), false);
    assert.equal(serialized.includes("accesstoken"), false);
    assert.equal(serialized.includes("conversationid"), false);
    assert.equal(serialized.includes("shareddocumentcontent"), false);
  });

  it("does not include draft excerpts unless the operation requires them", async () => {
    const explain = await buildLifecycleAiProviderContext({
      identity: { participantId: "member-1", displayName: "Alex Author" },
      initiative,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      presentationMode: "author_workspace",
      operation: "explain",
      currentDraftExcerpt: "Draft text that should be ignored for explain.",
    });
    assert.equal(explain.currentDraftExcerpt, undefined);

    const improve = await buildLifecycleAiProviderContext({
      identity: { participantId: "member-1", displayName: "Alex Author" },
      initiative,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      presentationMode: "author_workspace",
      operation: "improve_wording",
      currentDraftExcerpt: "Draft text for improve wording.",
    });
    assert.equal(improve.currentDraftExcerpt, "Draft text for improve wording.");
  });

  it("rejects credential-like payload material", () => {
    assert.throws(
      () =>
        assertLifecycleAiPayloadIsPrivateFree(
          { draftExcerpt: "here is sk-abcdefghijklmnopqrstuvwx" },
          "test",
        ),
      /credential material/i,
    );
  });
});
