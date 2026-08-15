import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveInitiativeLifecyclePresentationMode } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-author-mode.js";

const STEWARD_ID = "participant-steward";
const OTHER_ID = "participant-other";

describe("Initiative Lifecycle Part A — server-authoritative Author Mode resolution", () => {
  it("grants author_workspace only to the real steward, only on a stage where Author Mode applies", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: STEWARD_ID,
      viewerParticipantId: STEWARD_ID,
      stageId: "analysis",
      isActiveAlly: false,
    });

    assert.equal(result.viewerRole, "author");
    assert.equal(result.isInitiativeAuthor, true);
    assert.equal(result.isAuthorWorkspaceStage, true);
    assert.equal(result.presentationMode, "author_workspace");
  });

  it("keeps the steward in public mode on the root 'initiative' stage — Author Mode begins at Collaborative Analysis", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: STEWARD_ID,
      viewerParticipantId: STEWARD_ID,
      stageId: "initiative",
      isActiveAlly: false,
    });

    assert.equal(result.viewerRole, "author");
    assert.equal(result.isInitiativeAuthor, true);
    assert.equal(result.isAuthorWorkspaceStage, false);
    assert.equal(result.presentationMode, "public");
  });

  it("never grants author_workspace to an Active Ally, even past Collaborative Analysis", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: STEWARD_ID,
      viewerParticipantId: OTHER_ID,
      stageId: "archive",
      isActiveAlly: true,
    });

    assert.equal(result.viewerRole, "active_ally");
    assert.equal(result.isInitiativeAuthor, false);
    assert.equal(result.presentationMode, "public");
  });

  it("never trusts a client-supplied identity match — a null viewer is always a guest, never the author", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: STEWARD_ID,
      viewerParticipantId: null,
      stageId: "analysis",
      isActiveAlly: false,
    });

    assert.equal(result.viewerRole, "guest");
    assert.equal(result.isInitiativeAuthor, false);
    assert.equal(result.presentationMode, "public");
  });

  it("resolves an authenticated non-Author, non-Ally viewer as 'participant', still public mode", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: STEWARD_ID,
      viewerParticipantId: OTHER_ID,
      stageId: "analysis",
      isActiveAlly: false,
    });

    assert.equal(result.viewerRole, "participant");
    assert.equal(result.presentationMode, "public");
  });

  it("rejects an empty-string viewerParticipantId as the Author even if it happened to equal an empty stewardId", () => {
    const result = resolveInitiativeLifecyclePresentationMode({
      initiativeStewardId: "",
      viewerParticipantId: "",
      stageId: "analysis",
      isActiveAlly: false,
    });

    assert.equal(result.isInitiativeAuthor, false);
    assert.equal(result.viewerRole, "guest");
  });
});
